import type {Request, Response} from "express";
import {drizzle} from 'drizzle-orm/neon-http';
import {getAuth} from "@clerk/express";
import genAI from "../config/gemini.ts";
import {fridgeTable} from "../db/schema.ts";

const db = drizzle(process.env.DATABASE_URL!);

export const scanFridge = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    const {image, household_id, user_id} = req.body;
    if (!image) return res.status(400).send("No image provided");

    try {
        const response = await genAI.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: image,
                            }
                        },
                        {
                            text: "Analyze this fridge image. Return ONLY a JSON array, no markdown, no explanation:"
                        }
                    ]
                }
            ]
        })

        const raw = response.text ?? "";
        const items = JSON.parse(raw);

        const inserted = await db.insert(fridgeTable).values(
            items.map((item: any) => ({
                ...item,
                household_id: household_id,
            }))
        ).returning();
        return res.status(200).send(inserted);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}