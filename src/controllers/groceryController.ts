import type {Request, Response} from "express";
import {getAuth} from "@clerk/express";
import {profilesTable, shoppingTable, fridgeTable, recipesTable} from "../db/schema.ts";
import {eq} from "drizzle-orm";
import {db} from "../config/db.ts";

export const getGroceryItems = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }

    try {
        const [user] = await db.select().from(profilesTable).where(eq(profilesTable.clerk_id, userId));

        if (!user?.household_id) return res.status(400).send("User has no household");

        const grocery = await db.select().from(shoppingTable).where(eq(shoppingTable.household_id, user.household_id));
        res.status(200).send(grocery);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const deleteGroceryItem = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    const id = req.params.id
    if (typeof id !== 'string') {
        return res.status(400).json({message: "Invalid ID provided"});
    }

    try {
        await db.delete(shoppingTable).where(eq(shoppingTable.id, id))
        res.status(200).json({message: "Item deleted"});
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const purchaseGroceryItem = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) return res.status(401).send("Unauthorized");

    const {id} = req.params;
    if (!id || typeof id !== "string") return res.status(400).json({message: "id required"});

    try {
        const result = await db.transaction(async (tx) => {
            const [shoppingItem] = await tx
                .select()
                .from(shoppingTable)
                .where(eq(shoppingTable.id, id));

            if (!shoppingItem) throw new Error("Shopping item not found");

            // 1. Neuen Fridge-Eintrag anlegen (gleiche ID wiederverwenden)
            const [fridgeItem] = await tx.insert(fridgeTable).values({
                id: shoppingItem.id, // <- ID wiederverwenden
                household_id: shoppingItem.household_id,
                name: shoppingItem.name,
                quantity: shoppingItem.quantity,
                unit: shoppingItem.unit,
                unit_type: shoppingItem.unit_type,
                emoji: shoppingItem.emoji,
                expires_at: new Date(),
            }).returning();

            // 2. Shopping-Eintrag löschen
            await tx.delete(shoppingTable).where(eq(shoppingTable.id, id));

            // 3. Zugehöriges Rezept aktualisieren, falls vorhanden
            if (shoppingItem.recipe_id) {
                const [recipe] = await tx
                    .select()
                    .from(recipesTable)
                    .where(eq(recipesTable.id, shoppingItem.recipe_id));

                if (recipe) {
                    const updatedShoppingIds = (recipe.shopping_ingredient_ids as string[])
                        .filter((sid) => sid !== id);
                    const updatedFridgeIds = [
                        ...(recipe.fridge_ingredient_ids as string[]),
                        fridgeItem!.id,
                    ];

                    await tx.update(recipesTable)
                        .set({
                            shopping_ingredient_ids: updatedShoppingIds,
                            fridge_ingredient_ids: updatedFridgeIds,
                        })
                        .where(eq(recipesTable.id, recipe.id));
                }
            }

            return fridgeItem;
        });

        res.status(200).send(result);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}