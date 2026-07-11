import express from 'express';
import {sql} from "../config/db.ts";
import {createHousehold, createUser, getMe, getUserByUserId, updatePrefs} from "../controllers/authController.ts"
import {getAuth, clerkClient} from "@clerk/express";

const router = express.Router();

router.post("/", createUser);

router.post("/", createHousehold);

router.get('/health', async (req, res) => {
    const auth = getAuth(req);
    console.log('auth:', JSON.stringify(auth));
    if (!auth.isAuthenticated) {
        return res.status(401).send('User not authenticated')
    }

    try {
        const user = await clerkClient.users.getUser(auth.userId);
        console.log(user.lastName)
    } catch (e) {
        console.error(e);
        res.status(500).json({message: "Internal Server Error"});
    }
    return res.json(auth.userId)
});


router.get("/me", getMe);

router.patch("/me", updatePrefs);

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