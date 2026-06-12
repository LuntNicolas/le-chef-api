import type {Request, Response} from "express";
import {getAuth} from "@clerk/express";
import {getFridgeItems} from "../utils/getFridgeItems.ts";

export const getRecipe = async (req: Request, res: Response) => {
    const {userId} = getAuth(req);
    if (!userId) {
        return res.status(404).send("No user found with the user id");
    }
    try {
        const fridgeItems = await getFridgeItems(userId);
        console.log(fridgeItems);
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
}