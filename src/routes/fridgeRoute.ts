import express from 'express';
import {sql} from "../config/db.ts";
import {createHousehold} from "../controllers/authController.ts";
import {addItem, deductItem, deleteItem, getFridge, scanFridge} from "../controllers/fridgeController.ts";

const router = express.Router();

router.post("/scan", scanFridge);

router.post("/add", addItem)

router.get("/", getFridge);

router.patch("/:id/deduct", deductItem);

router.delete("/:id", deleteItem);

export default router;