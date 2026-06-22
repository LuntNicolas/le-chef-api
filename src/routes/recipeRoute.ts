import express from "express";
import {generateRecipe, getRecipe, getRecipesById} from "../controllers/recipeController.ts";

const router = express.Router();

router.get("/generate", generateRecipe)
router.get("/", getRecipe)
router.get("/:id", getRecipesById)

export default router;