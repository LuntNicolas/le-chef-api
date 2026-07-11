import type {Request, Response} from "express";
import {drizzle} from 'drizzle-orm/neon-http';
import {getAuth, clerkClient} from "@clerk/express";
import {householdsTable, profilesTable} from "../db/schema.ts";
import {eq} from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

export const getUserByUserId = async (req: Request, res: Response) => {
    try {
        const userId = req.params["userId"] as string;
        if (!userId) {
            return res.status(400).json({message: "userId is required"});
        }
        const users = await db.select().from(profilesTable).where(eq(profilesTable.clerk_id, userId));
        if (users.length === 0) {
            return res.status(404).json({message: "User not found"});
        }
        res.status(200).json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const getMe = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(401).send('User not authenticated')
    }
    try {
        const [profile] = await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.clerk_id, userId))
            .limit(1);

        if (!profile) {
            return res.status(404).json({message: "Profile not found"});
        }
        res.status(200).json(profile);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const updatePrefs = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(401).send('User not authenticated')
    }
    const {dietary_prefs} = req.body;
    if (!Array.isArray(dietary_prefs) || dietary_prefs.some((p) => typeof p !== "string")) {
        return res.status(400).json({message: "dietary_prefs must be an array of strings"});
    }
    try {
        const [updated] = await db
            .update(profilesTable)
            .set({dietary_prefs})
            .where(eq(profilesTable.clerk_id, userId))
            .returning();

        if (!updated) {
            return res.status(404).json({message: "Profile not found"});
        }
        res.status(200).json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const {userId: clerk_id} = getAuth(req);
        if (!clerk_id) {
            return res.status(401).send('User not authenticated')
        }
        const user = await clerkClient.users.getUser(clerk_id);
        if (!user.lastName) {
            return res.status(400).send('Last name is required');
        }

        const {dietary_prefs, household_size} = req.body;

        const size = Number(household_size);
        const validSize = Number.isInteger(size) && size >= 1 && size <= 12 ? size : 2;

        const [household] = await db.insert(householdsTable).values({
            name: `${user.firstName} ${user.lastName}`,
        }).returning();

        if (!household) {
            return res.status(400).send('Host name is required');
        }

        await db.insert(profilesTable).values({
            clerk_id,
            household_id: household.id,
            dietary_prefs: dietary_prefs ?? [],
        }).returning();


        res.status(200).json({message: "User created successfully"});
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const createHousehold = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(401).send('User not authenticated')
    }
    try {
        const user = await clerkClient.users.getUser(userId);
        if (!user.lastName) {
            return res.status(400).send('Last Name is required');
        }

        const household = await db.insert(householdsTable).values({
            name: user.lastName,
        }).returning();
        res.status(200).json(household);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}