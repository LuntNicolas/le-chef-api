import type {Request, Response} from "express";
import {getAuth} from "@clerk/express";
import {getFridgeItems} from "../utils/getFridgeItems.ts";
import openAI from "../config/openai.ts";
import {db} from "../config/db.ts";
import {fridgeTable, profilesTable, recipesTable, shoppingTable} from "../db/schema.ts";
import {and, eq, inArray} from "drizzle-orm";
import {deductAmount} from "../utils/deductAmount.ts";
import {unitEnum} from "../db/schema.ts";

type UnitEnumValue = typeof unitEnum.enumValues[number];

interface ShoppingIngredient {
    name: string;
    quantity: number;
    unit: string;
    unit_type: string;
    emoji: string;
}

interface FridgeIngredient {
    id: string;
    name: string;
    quantity: number;
    unit: string;
}

interface Recipe {
    title: string;
    meal_type: string;
    date: string;
    fridge_ingredients: FridgeIngredient[];
    shopping_ingredients: ShoppingIngredient[];
    steps: string[];
    duration: number;
    kcal: number;
}

// JSON schema enforced via OpenAI structured outputs — the model cannot return
// markdown fences or malformed JSON, only a syntactically valid week plan.
const WEEK_PLAN_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["recipes"],
    properties: {
        recipes: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "meal_type", "date", "kcal", "duration", "fridge_ingredients", "shopping_ingredients", "steps"],
                properties: {
                    title: {type: "string"},
                    meal_type: {type: "string", enum: ["breakfast", "lunch", "dinner"]},
                    date: {type: "string", description: "YYYY-MM-DD"},
                    kcal: {type: "integer"},
                    duration: {type: "integer", description: "minutes"},
                    fridge_ingredients: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["id", "name", "quantity", "unit"],
                            properties: {
                                id: {type: "string", description: "exact fridge item UUID from the prompt"},
                                name: {type: "string"},
                                quantity: {type: "number"},
                                unit: {type: "string", enum: ["stück", "g", "ml"]},
                            },
                        },
                    },
                    shopping_ingredients: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["name", "quantity", "unit", "unit_type", "emoji"],
                            properties: {
                                name: {type: "string"},
                                quantity: {type: "number"},
                                unit: {type: "string", enum: ["stück", "g", "ml"]},
                                unit_type: {type: "string", enum: ["count", "weight", "volume"]},
                                emoji: {type: "string"},
                            },
                        },
                    },
                    steps: {type: "array", items: {type: "string"}},
                },
            },
        },
    },
};

export const generateRecipe = async (req: Request, res: Response) => {
    // plan the next 7 days starting today — anchoring to Monday meant a plan
    // generated on the weekend was already in the past and never showed in the app
    const today = new Date();
    const weekDates = Array.from({length: 7}, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d.toISOString().split("T")[0];
    });

    const {userId} = getAuth(req);
    if (!userId) return res.status(401).send("Unauthorized");

    try {
        const fridgeItems = await getFridgeItems(userId);

        const [profile] = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.clerk_id, userId))
            .limit(1);

        if (!profile) return res.status(404).send("Profile not found");

        const householdSize = profile.household_size ?? 2;
        const dietaryPrefs = Array.isArray(profile.dietary_prefs) ? profile.dietary_prefs as string[] : [];
        const dietaryLine = dietaryPrefs.length > 0
            ? `\nWICHTIG — Ernährungsvorgaben des Haushalts (MÜSSEN in JEDEM Rezept eingehalten werden): ${dietaryPrefs.join(", ")}.`
            : "";

        const response = await openAI.responses.create({
            model: "gpt-4o-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Du bist ein Küchenchef. Du kochst für einen Haushalt mit ${householdSize} ${householdSize === 1 ? "Person" : "Personen"}.${dietaryLine}
Dir stehen folgende Zutaten im Kühlschrank zur Verfügung (jede mit eindeutiger ID):

${fridgeItems?.map((item) => `- ID ${item.id}: ${item.name} (${item.quantity} ${item.unit}${item.expires_at ? `, läuft ab: ${item.expires_at}` : ""})`).join("\n")}

Erstelle einen vollständigen Plan für die nächsten 7 Tage (${weekDates[0]} bis ${weekDates[6]}).
Pro Tag genau 3 Mahlzeiten: breakfast, lunch, dinner. Das ergibt genau 21 Rezepte.

Regeln:
- Kühlschrank-Zutaten haben eine ID — verwende diese exakt in "fridge_ingredients".
- Fehlende Zutaten kommen in "shopping_ingredients" (keine ID nötig).
- Zutaten die bald ablaufen MÜSSEN an den ersten Tagen verwendet werden.
- Verwende als "date" ausschließlich diese Werte: ${weekDates.join(", ")}. Format YYYY-MM-DD. "meal_type" ist exakt "breakfast", "lunch" oder "dinner".
- Mengen und Kalorien beziehen sich auf ${householdSize} ${householdSize === 1 ? "Person" : "Personen"} — schätze realistisch.

EINHEITEN: nur "stück", "g" oder "ml" erlaubt.
- Zählbares → "stück", unit_type: "count"
- Gewicht → "g", unit_type: "weight"
- Flüssigkeit → "ml", unit_type: "volume"

Gib genau 21 Rezepte im Feld "recipes" zurück. Halte die Schritte ("steps") kurz und präzise.`
                        }
                    ]
                }
            ],
            max_output_tokens: 16000,
            text: {
                format: {
                    type: "json_schema",
                    name: "weekly_meal_plan",
                    strict: true,
                    schema: WEEK_PLAN_SCHEMA,
                },
            },
        });

        // a truncated response (token limit) is reported here instead of surfacing as broken JSON
        if (response.status !== "completed") {
            console.error("Recipe generation incomplete:", response.status, response.incomplete_details);
            return res.status(502).json({message: "Recipe generation was cut off — please try again"});
        }

        let recipes: Recipe[];
        try {
            const parsed = JSON.parse(response.output_text ?? "");
            recipes = parsed.recipes ?? [];
        } catch (e) {
            console.error("Model returned invalid JSON:", (response.output_text ?? "").slice(0, 300));
            return res.status(502).json({message: "Invalid response from recipe generator — please try again"});
        }

        if (recipes.length === 0) {
            return res.status(502).json({message: "No recipes generated — please try again"});
        }

        console.log("Anzahl Rezepte:", recipes.length);

        const recipeShoppingMap = recipes.flatMap((recipe, i) =>
            (recipe.shopping_ingredients ?? []).map((item) => ({recipeIndex: i, item}))
        );

        const insertedShopping = recipeShoppingMap.length > 0
            ? await db.insert(shoppingTable).values(
                recipeShoppingMap.map(({item}) => ({
                    household_id: profile.household_id,
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit as "stück" | "g" | "ml",
                    // derive from unit when the model omits it — a missing value would
                    // render as DEFAULT and fail the whole batch (unit_type has no default)
                    unit_type: (item.unit_type ?? (item.unit === "g" ? "weight" : item.unit === "ml" ? "volume" : "count")) as "count" | "weight" | "volume",
                    emoji: item.emoji ?? "🛒",
                    expires_at: new Date(),
                }))
            ).returning()
            : [];


        const shoppingIdsByRecipe: Record<number, string[]> = {};
        recipeShoppingMap.forEach(({recipeIndex}, i) => {
            if (!shoppingIdsByRecipe[recipeIndex]) shoppingIdsByRecipe[recipeIndex] = [];
            shoppingIdsByRecipe[recipeIndex]!.push(insertedShopping[i]!.id);
        });

        console.log("insertedShopping count:", insertedShopping.length);
        console.log("shoppingIdsByRecipe:", JSON.stringify(shoppingIdsByRecipe, null, 2));

        await db.insert(recipesTable).values(
            recipes.map((recipe, i) => ({
                household_id: profile.household_id,
                title: recipe.title,
                meal_type: recipe.meal_type,
                date: recipe.date,
                kcal: recipe.kcal ?? 0,
                duration: recipe.duration,
                steps: recipe.steps,
                fridge_ingredient_ids: (recipe.fridge_ingredients ?? []).map((f) => f.id),
                shopping_ingredient_ids: shoppingIdsByRecipe[i] ?? [],
            }))
        );

        res.status(200).send();
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const getRecipe = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) return res.status(401).send("Unauthorized");

    try {
        const {date} = req.query;
        if (!date || date === "undefined") {
            return res.status(400).json({message: "date required"});
        }

        const [profile] = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.clerk_id, userId))
            .limit(1);

        if (!profile?.household_id) return res.status(400).json({message: "No household found"});

        const recipes = await db
            .select()
            .from(recipesTable)
            .where(
                and(
                    eq(recipesTable.date, date as string),
                    eq(recipesTable.household_id, profile.household_id)
                )
            );

        return res.status(200).json(recipes);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const cookRecipe = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) return res.status(401).send("Unauthorized");

    try {
        const {id} = req.params;
        if (!id || typeof id !== "string") return res.status(400).json({message: "id required"});

        const [profile] = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.clerk_id, userId))
            .limit(1);

        if (!profile?.household_id) return res.status(400).json({message: "No household found"});

        const [recipe] = await db
            .select()
            .from(recipesTable)
            .where(
                and(
                    eq(recipesTable.id, id),
                    eq(recipesTable.household_id, profile.household_id)
                )
            );

        if (!recipe) return res.status(404).json({message: "Recipe not found"});

        const ingredients = (recipe.fridge_ingredient_ids as FridgeIngredient[]) ?? [];
        const deducted: { id: string; name: string; remaining: number; unit: string }[] = [];

        for (const ingredient of ingredients) {
            if (!ingredient?.id) continue;

            const [item] = await db
                .select()
                .from(fridgeTable)
                .where(
                    and(
                        eq(fridgeTable.id, ingredient.id),
                        eq(fridgeTable.household_id, profile.household_id)
                    )
                );

            if (!item) continue; // already used up or deleted

            const result = deductAmount(item.quantity, item.unit, ingredient.quantity, ingredient.unit);
            if (!result) continue; // incompatible units — leave the item untouched

            if (result.remaining <= 0) {
                await db.delete(fridgeTable).where(eq(fridgeTable.id, item.id));
                deducted.push({id: item.id, name: item.name, remaining: 0, unit: result.unit});
            } else {
                await db.update(fridgeTable)
                    .set({quantity: result.remaining, unit: result.unit as UnitEnumValue})
                    .where(eq(fridgeTable.id, item.id));
                deducted.push({id: item.id, name: item.name, remaining: result.remaining, unit: result.unit});
            }
        }

        return res.status(200).json({recipe_id: recipe.id, deducted});
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const getRecipesById = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) return res.status(401).send("Unauthorized");

    try {
        const {id} = req.params;
        if (!id || typeof id !== "string") return res.status(400).json({message: "id required"});


        const [recipe] = await db
            .select()
            .from(recipesTable)
            .where(eq(recipesTable.id, id));

        if (!recipe) return res.status(404).send("Recipe not found");

        const storedFridgeIngredients = (recipe.fridge_ingredient_ids as FridgeIngredient[]) ?? [];
        const fridgeIds = (recipe.fridge_ingredient_ids as string[]) ?? [];
        const shoppingIds = (recipe.shopping_ingredient_ids as string[]) ?? [];

        const [fridgeItems, shoppingItems] = await Promise.all([
            storedFridgeIngredients.length === 0 && fridgeIds.length > 0
                ? db.select().from(fridgeTable).where(inArray(fridgeTable.id, fridgeIds))
                : Promise.resolve([]),
            shoppingIds.length > 0
                ? db.select().from(shoppingTable).where(inArray(shoppingTable.id, shoppingIds))
                : Promise.resolve([]),
        ]);

        return res.status(200).json({
            ...recipe,
            // stored per-recipe amounts; fall back to live fridge rows for recipes generated before the column existed
            fridge_ingredients: storedFridgeIngredients.length > 0 ? storedFridgeIngredients : fridgeItems,
            shopping_ingredients: shoppingItems,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}