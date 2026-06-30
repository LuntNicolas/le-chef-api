import express from "express";
import {getGroceryItems, deleteGroceryItem, purchaseGroceryItem} from "../controllers/groceryController.ts";

const router = express.Router();

router.get("/", getGroceryItems)
router.delete("/delete/:id", deleteGroceryItem);
router.post("/purchase/:id", purchaseGroceryItem);

export default router;