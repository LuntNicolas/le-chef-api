import express from "express";
import {getGroceryItems, deleteGroceryItem} from "../controllers/groceryController.ts";

const router = express.Router();

router.get("/", getGroceryItems)
router.delete("/delete/:id", deleteGroceryItem);

export default router;