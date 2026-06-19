import express from "express";
import {generateRecipe, getRecipe} from "../controllers/recipeController.ts";

const router = express.Router();

router.get("/generate", generateRecipe)
router.get("/", getRecipe)

export default router;