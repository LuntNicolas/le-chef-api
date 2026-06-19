import express from "express";
import {getGroceryItems} from "../controllers/groceryController.ts";

const router = express.Router();

router.get("/", getGroceryItems)

export default router;