import express from 'express';
import type {Request, Response} from "express";
import {db} from "../config/db.ts";
import {fridgeTable, recipesTable, shoppingTable} from "../db/schema.ts";
import {and, asc, eq, inArray} from "drizzle-orm";

// Read-only, unauthenticated endpoints serving a seeded demo household so the
// API can be explored (job interviews, portfolio) without a Clerk account.
// Enabled by setting DEMO_HOUSEHOLD_ID — see src/scripts/seedDemo.ts.

const router = express.Router();

const requireDemoHousehold = (res: Response): string | null => {
    const id = process.env.DEMO_HOUSEHOLD_ID;
    if (!id) {
        res.status(503).json({message: "Demo mode is not configured on this deployment"});
        return null;
    }
    return id;
}

router.get("/", (_req: Request, res: Response) => {
    res.json({
        message: "Le Chef demo API — read-only data of a seeded demo household",
        endpoints: [
            "GET /api/demo/fridge",
            "GET /api/demo/recipes?date=YYYY-MM-DD",
            "GET /api/demo/recipe/:id",
            "GET /api/demo/grocery",
        ],
    });
});

router.get("/fridge", async (_req: Request, res: Response) => {
    const householdId = requireDemoHousehold(res);
    if (!householdId) return;
    try {
        const items = await db
            .select()
            .from(fridgeTable)
            .where(eq(fridgeTable.household_id, householdId))
            .orderBy(asc(fridgeTable.expires_at));
        res.status(200).json(items);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
});

router.get("/recipes", async (req: Request, res: Response) => {
    const householdId = requireDemoHousehold(res);
    if (!householdId) return;
    try {
        const {date} = req.query;
        const filters = [eq(recipesTable.household_id, householdId)];
        if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            filters.push(eq(recipesTable.date, date));
        }
        const recipes = await db
            .select()
            .from(recipesTable)
            .where(and(...filters))
            .orderBy(asc(recipesTable.date));
        res.status(200).json(recipes);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
});

router.get("/recipe/:id", async (req: Request, res: Response) => {
    const householdId = requireDemoHousehold(res);
    if (!householdId) return;
    try {
        const {id} = req.params;
        if (!id || typeof id !== "string") return res.status(400).json({message: "id required"});
        const [recipe] = await db
            .select()
            .from(recipesTable)
            .where(and(eq(recipesTable.id, id), eq(recipesTable.household_id, householdId)));

        if (!recipe) return res.status(404).json({message: "Recipe not found"});

        const shoppingIds = (recipe.shopping_ingredient_ids as string[]) ?? [];
        const shoppingItems = shoppingIds.length > 0
            ? await db.select().from(shoppingTable).where(inArray(shoppingTable.id, shoppingIds))
            : [];

        res.status(200).json({
            ...recipe,
            shopping_ingredients: shoppingItems,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
});

router.get("/grocery", async (_req: Request, res: Response) => {
    const householdId = requireDemoHousehold(res);
    if (!householdId) return;
    try {
        const items = await db
            .select()
            .from(shoppingTable)
            .where(eq(shoppingTable.household_id, householdId));
        res.status(200).json(items);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
});

export default router;
