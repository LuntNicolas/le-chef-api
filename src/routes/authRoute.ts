import express from 'express';
import {sql} from "../config/db.ts";
import {createUser, getUserByUserId} from "../controllers/authController.ts"

const router = express.Router();

router.post("/", createUser)

router.get("/:userId", getUserByUserId)

router.delete("/:userId", async (req, res) => {
    try {
        const {userId} = req.params;
        const result = await sql`DELETE
                                 FROM users
                                 WHERE user_id = ${userId} RETURNING *`;

        if (result.length === 0) {
            return res.status(404).json({message: "User not found"});
        }
        res.status(200).json({message: "Deleted successfully"});
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Error deleting user"});
    }
})

export default router;