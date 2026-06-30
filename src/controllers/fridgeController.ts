import type {Request, Response} from "express";
import {drizzle} from 'drizzle-orm/neon-http';
import {getAuth} from "@clerk/express";
import genAI from "../config/gemini.ts";
import openAI from "../config/openai.ts";
import {fridgeTable, profilesTable, recipesTable} from "../db/schema.ts";
import {eq, asc, sql} from "drizzle-orm";
import {normalizeUnit} from "../utils/normalizeUnit.ts";
import {deductAmount} from "../utils/deductAmount.ts";
import {unitEnum} from "../db/schema.ts";

type UnitEnumValue = typeof unitEnum.enumValues[number];

const db = drizzle(process.env.DATABASE_URL!);

export const scanFridge = async (req: Request, res: Response) => {
    const date = new Date();
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }

    const {image, household_id, user_id} = req.body;
    if (!image) return res.status(400).send("No image provided");

    try {
        const response = await openAI.responses.create({
            model: "gpt-5.4-mini",
            input: [
                {
                    role: "user",
                    content: [
                        {
                            type: "input_image",
                            image_url: `data:image/jpeg;base64,${image}`,
                            detail: "auto"
                        },
                        {
                            type: "input_text",
                            text: `Du bist ein präziser Inventar-Assistent. Analysiere das Bild des Kühlschranks und gib ausschließlich ein valides JSON-Array zurück.
WICHTIGE REGELN:
NORMALISIERUNG
Verwende nur einfache, generische Begriffe.
Beispiele:
"Milch" statt "Bio Vollmilch"
"Joghurt" statt "Griechischer Joghurt"
"Tomate" statt "Cherrytomaten"
Keine Markennamen.
Keine Gewichtsangaben oder Produktvarianten im Namen.
Der Name darf maximal 15 Zeichen lang sein.
DUBLETTEN ZUSAMMENFÜHREN
Identische oder offensichtlich gleiche Produkte müssen zu einem Eintrag zusammengeführt werden.
Beispiel:
2 Packungen Milch + 1 weitere Milch = quantity 3
Mehrere Tomatenpackungen = ein Eintrag "Tomate" mit aufsummierter Menge
Erzeuge niemals mehrere Objekte mit demselben normalisierten Namen.
MENGENSCHÄTZUNG
quantity muss eine Zahl sein.
Schätze Mengen konservativ.
Wenn die genaue Menge nicht erkennbar ist, verwende 1.
EINHEITEN
Verwende nur sinnvolle Einheiten:
Stück
Packung
Flasche
Glas
Dose
g
ml
EMOJIS
Verwende genau ein passendes Emoji pro Artikel.
ABLAUFDATUM
Falls ein Ablaufdatum sichtbar ist, verwende dieses.
Falls kein Datum erkennbar ist:
Nutze das heutige Datum + 7 Tage als Standardwert.
Das Datum muss im Format YYYY-MM-DD ausgegeben werden.
UNSICHERHEIT
Wenn ein Produkt nicht eindeutig identifizierbar ist, ignoriere es.
Niemals raten oder Fantasieprodukte erzeugen.
AUSGABEFORMAT
Gib ausschließlich ein valides JSON-Array zurück.
Keine Markdown-Blöcke.
Keine Erklärungen.
Kein zusätzlicher Text.
Die Antwort muss direkt mit "[" beginnen und mit "]" enden.
                    `
                        }
                    ]
                }
            ]
        })

        const raw = response.output_text ?? "";
        const items = JSON.parse(raw);

        console.log(items);

        const [profile] = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.clerk_id, userId))
            .limit(1);

        if (!profile) return res.status(404).send("Profile not found");

        const inserted = await db.insert(fridgeTable).values(
            items.map((item: any) => {
                const norm = normalizeUnit(item.name, item.unit, item.quantity);
                return {
                    name: item.name,
                    quantity: norm.quantity,
                    unit: norm.unit,
                    unit_type: norm.unit_type,
                    emoji: item.emoji,
                    expires_at: new Date(),
                    household_id: profile.household_id,
                    added_by: profile.user_id,
                };
            })
        ).returning();

        return res.status(200).send(inserted);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const addItem = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    const {id, household_id, name, quantity, expires_at, unit, emoji, unit_type} = req.body;

    const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.clerk_id, userId))

    if (!profile) return res.status(404).send("Profile not found");

    if (!profile.household_id || typeof profile.household_id !== "string") return res.status(400).json({message: "id required"});

    const recipes = await db
        .select()
        .from(recipesTable)
        .where(eq(recipesTable.household_id, profile.household_id));

    const recipe = recipes.find((r) =>
        (r.shopping_ingredient_ids as string[]).includes(id)
    );

    if (recipe) {
        const updatedFridgeIds = [
            ...(recipe.fridge_ingredient_ids as string[]),
            id,
        ];
        const updatedShoppingIds = (recipe.shopping_ingredient_ids as string[])
            .filter((sid) => sid !== id);

        console.log(recipe.fridge_ingredient_ids);
        console.log(typeof recipe.fridge_ingredient_ids);
        console.log(Array.isArray(recipe.fridge_ingredient_ids));


        const result = await db.update(recipesTable)
            .set({
                fridge_ingredient_ids: updatedFridgeIds,
                shopping_ingredient_ids: updatedShoppingIds,
            })
            .where(eq(recipesTable.id, recipe.id)).returning();

        console.log(result);

        console.log("NACHHER (returning):", result[0]?.fridge_ingredient_ids);
    }


    const insert = await db.insert(fridgeTable).values({
        id: id,
        household_id: profile.household_id,
        name: name,
        quantity: quantity,
        expires_at: new Date(expires_at),
        emoji: emoji,
        unit: unit,
        unit_type: unit_type,
    }).returning();

    return res.status(200).send(insert);
}

export const getFridge = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }

    try {
        const [user] = await db.select().from(profilesTable).where(eq(profilesTable.clerk_id, userId));

        if (!user?.household_id) return res.status(400).send("User has no household");

        const food = await db
            .select()
            .from(fridgeTable)
            .where(eq(fridgeTable.household_id, user.household_id))
            .orderBy(asc(fridgeTable.expires_at));
        res.status(200).send(food);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const deleteItem = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    const id = req.params.id;

    if (typeof id !== 'string') {
        return res.status(400).json({message: "Invalid ID provided"});
    }
    try {
        await db.delete(fridgeTable).where(eq(fridgeTable.id, id))
        res.status(200).json({message: "Item deleted"});
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const deductItem = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) return res.status(401).send("Unauthorized");

    const id = req.params.id;
    const {quantity, unit} = req.body as { quantity: number; unit: string };

    if (!id || typeof id !== "string") {
        return res.status(400).json({message: "Invalid ID"});
    }

    try {
        const [item] = await db
            .select()
            .from(fridgeTable)
            .where(eq(fridgeTable.id, id));

        if (!item) return res.status(404).json({message: "Item not found"});

        const result = deductAmount(item.quantity, item.unit, quantity, unit);

        if (!result) {
            return res.status(400).json({message: "Incompatible units"});
        }

        if (result.remaining <= 0) {
            await db.delete(fridgeTable).where(eq(fridgeTable.id, id));
        } else {
            await db.update(fridgeTable)
                .set({
                    quantity: result.remaining,
                    unit: result.unit as UnitEnumValue
                })
                .where(eq(fridgeTable.id, id));
        }

        res.status(200).json({remaining: Math.max(result.remaining, 0), unit: result.unit});
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}