import express from "express";
import {cookRecipe, generateRecipe, getRecipe, getRecipesById} from "../controllers/recipeController.ts";

const router = express.Router();

router.get("/generate", generateRecipe)
router.get("/", getRecipe)
router.post("/:id/cook", cookRecipe)
router.get("/:id", getRecipesById)

export default router;
