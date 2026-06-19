import type {Request, Response} from "express";
import {getAuth} from "@clerk/express";
import {getFridgeItems} from "../utils/getFridgeItems.ts";
import openAI from "../config/openai.ts";
import {db} from "../config/db.ts";
import {profilesTable, recipesTable, shoppingTable} from "../db/schema.ts";
import {eq} from "drizzle-orm";

interface ShoppingIngredient {
    name: string;
    quantity: number;
    unit: string;
}

interface Recipe {
    title: string;
    meal_type: string;
    date: string;
    fridge_ingredients: { id: string; name: string; quantity: number; unit: string }[];
    shopping_ingredients: ShoppingIngredient[];
    steps: string[];
    duration: number;
}

export const generateRecipe = async (req: Request, res: Response) => {
    const today = new Date();
    const diff = today.getDay() === 0 ? 6 : today.getDay() - 1;

    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);

    const weekDates = Array.from({length: 7}, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });

    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    try {
        const fridgeItems = await getFridgeItems(userId);
        // console.log(fridgeItems?.map(({id, name, quantity, unit}) => ({id, name, quantity, unit})));

        const response = await openAI.responses.create({
            model: "gpt-5.4-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: `Du bist ein Küchenchef. Dir stehen folgende Zutaten im Kühlschrank zur Verfügung (jede mit eindeutiger ID):

${fridgeItems?.map((item) => `- ID ${item.id}: ${item.name} (${item.quantity} ${item.unit}${item.expires_at ? `, läuft ab: ${item.expires_at}` : ""})`).join("\n")}

Erstelle einen vollständigen Wochenplan von Montag bis Sonntag (${weekDates[0]} bis ${weekDates[6]}).
Pro Tag genau 3 Mahlzeiten: breakfast, lunch, dinner.
Das ergibt genau 21 Rezepte.

Regeln:
- Zutaten aus dem Kühlschrank haben eine ID — verwende diese exakt.
- Du darfst auch Zutaten verwenden die NICHT im Kühlschrank sind. Diese kommen in "shopping_ingredients" (keine ID).
- Gib für jede verwendete Zutat die benötigte Menge ("quantity") und Einheit ("unit") an.
- Die angegebene quantity einer Kühlschrankzutat darf die verfügbare Menge nicht überschreiten.
- "date" im Format YYYY-MM-DD, passend zum Wochentag.
- "meal_type" ist exakt "breakfast", "lunch" oder "dinner".
- Zutaten die bald ablaufen MÜSSEN in Rezepten verwendet werden die so nah wie möglich am heutigen Tag (${today}) liegen.
- Versuche alle Kühlschrankzutaten im Laufe der Woche zu verbrauchen.
- Plane so dass am Ende der Woche möglichst wenig im Kühlschrank übrig bleibt.

EINHEITEN (wähle IMMER nach folgendem Schema):
- Zählbare Lebensmittel (Eier, Obststücke, Joghurtbecher, Dosen, Flaschen) → "stück"
- Lebensmittel die nach Gewicht verkauft werden (Mehl, Zucker, Reis, Käse, Fleisch) → "g"
- Flüssigkeiten (Milch, Öl, Saft) → "ml"

Gib zusätzlich zu jedem Artikel ein Feld "unit_type" zurück: "count" | "weight" | "volume"

Antworte NUR mit einem JSON-Array ohne Markdown-Codeblock oder sonstige Erklärungen:
[
  {
    "title": "Rezeptname",
    "meal_type": "breakfast",
    "date": "2026-06-16",
    "fridge_ingredients": [
      { "id": "uuid-hier", "name": "Zutat1", "quantity": 2, "unit": "Stück" }
    ],
    "shopping_ingredients": [
      { "name": "Parmesan", "quantity": 50, "unit": "g" }
    ],
    "steps": [
      "Schritt 1: ..."
    ],
    "duration": 30
  }
]`
                        }
                    ]
                }
            ]
        })
        const raw = response.output_text ?? "";
        const recipes = JSON.parse(raw);

        const [profile] = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.clerk_id, userId))
            .limit(1);

        if (!profile) return res.status(404).send("Profile not found");

        const allShoppingWithIndex = recipes.flatMap((recipe: Recipe) =>
            (recipe.shopping_ingredients ?? []).map((item) => ({...item}))
        );

        const aggregatedShopping = allShoppingWithIndex.reduce((acc: any[], item: any) => {
            const existing = acc.find(
                (i) => i.name.toLowerCase() === item.name.toLowerCase() && i.unit === item.unit
            );
            if (existing) {
                existing.quantity += item.quantity;
            } else {
                acc.push({...item});
            }
            return acc;
        }, []);

        await db
            .insert(shoppingTable)
            .values(
                aggregatedShopping.map((item: any) => ({
                    household_id: profile.household_id,
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit,
                }))
            );

        await db.insert(recipesTable).values(
            recipes.map((recipe: Recipe) => ({
                household_id: profile.household_id,
                title: recipe.title,
                meal_type: recipe.meal_type,
                date: recipe.date,
                ingredients: recipe.fridge_ingredients ?? [],
                steps: recipe.steps,
                duration: recipe.duration,
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
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    try {
        const {date} = req.query;
        if (!date || date === "undefined") {
            return res.status(400).json({message: "date required"});
        }
        const r = await db
            .select()
            .from(recipesTable)
            .where(eq(recipesTable.date, date as string));

        return res.status(200).json(r);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}