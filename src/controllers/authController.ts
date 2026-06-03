import {sql} from "../config/db.ts";
import type {Request, Response} from "express";
import {drizzle} from 'drizzle-orm/neon-http';
import {getAuth} from "@clerk/express";
import {profilesTable} from "../db/schema.ts";

const db = drizzle(process.env.DATABASE_URL!);

export const getUserByUserId = async (req: Request, res: Response) => {
    try {
        const {userId} = req.params;
        const users = await sql`SELECT *
                                FROM users
                                WHERE user_id = ${userId}
                                ORDER BY created_at DESC`;
        res.status(200).json(users);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}

export const createUser = async (req: Request, res: Response) => {
    try {
        const {clerk_id, email, name, dietary_prefs} = req.body;

        if (!clerk_id || !name || !email || !dietary_prefs) {
            return res.status(400).json({message: "All fields are required"});
        }

        const users = await db.insert(profilesTable).values({
            clerk_id,
            email,
            name,
            dietary_prefs,
        }).returning();
        res.status(200).json(users[0])
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}