import rateLimit from "../config/upstash.ts";
import type {Request, Response, NextFunction} from "express";

const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const identifier = req.ip ?? "anonymous";
        const {success} = await rateLimit.limit(identifier);
        if (!success) {
            return res.status(429).json({message: "To many request, please try again later."});
        }
        next();
    } catch (error) {
        console.log("Rate limit error:", error);
        next(error);
    }
}

export default rateLimiter;