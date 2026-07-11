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

export const generateRecipe = async (req: Request, res: Response) => {
    const today = new Date();
    const diff = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    const weekDates = Array.from({length: 7}, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
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

        const householdSize = profile.household_id?.length;
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

Erstelle einen vollständigen Wochenplan von Montag bis Sonntag (${weekDates[0]} bis ${weekDates[6]}).
Pro Tag genau 3 Mahlzeiten: breakfast, lunch, dinner. Das ergibt genau 21 Rezepte.

Regeln:
- Kühlschrank-Zutaten haben eine ID — verwende diese exakt in "fridge_ingredients".
- Fehlende Zutaten kommen in "shopping_ingredients" (keine ID nötig).
- Zutaten die bald ablaufen MÜSSEN früh in der Woche verwendet werden.
- "date" im Format YYYY-MM-DD. "meal_type" ist exakt "breakfast", "lunch" oder "dinner".
- Mengen und Kalorien beziehen sich auf ${householdSize} ${householdSize === 1 ? "Person" : "Personen"} — schätze realistisch.

EINHEITEN: nur "stück", "g" oder "ml" erlaubt.
- Zählbares → "stück", unit_type: "count"
- Gewicht → "g", unit_type: "weight"
- Flüssigkeit → "ml", unit_type: "volume"

Antworte NUR mit einem JSON-Array ohne Markdown oder Erklärungen:
[
  {
    "title": "Rezeptname",
    "meal_type": "breakfast",
    "date": "2026-06-23",
    "kcal": 380,
    "duration": 15,
    "fridge_ingredients": [
      { "id": "uuid-aus-kühlschrank", "name": "Ei", "quantity": 2, "unit": "stück" }
    ],
    "shopping_ingredients": [
      { "name": "Parmesan", "quantity": 50, "unit": "g", "unit_type": "weight", "emoji": "🧀" }
    ],
    "steps": ["Schritt 1: ..."]
  }
]

JEDES shopping_ingredient MUSS enthalten: name, quantity, unit, unit_type, emoji.
Erlaubte unit-Werte: "stück", "g", "ml" — keine anderen.`
                        }
                    ]
                }
            ]
        });

        const raw = response.output_text ?? "";
        const recipes: Recipe[] = JSON.parse(raw);

        console.log("Erstes Rezept shopping_ingredients:", JSON.stringify(recipes[0]?.shopping_ingredients, null, 2));
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
                    unit_type: item.unit_type as "count" | "weight" | "volume",
                    emoji: item.emoji,
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