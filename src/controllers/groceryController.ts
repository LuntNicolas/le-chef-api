import type {Request, Response} from "express";
import {getAuth} from "@clerk/express";
import {profilesTable, shoppingTable} from "../db/schema.ts";
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