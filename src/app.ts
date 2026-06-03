import express from 'express';
import {clerkMiddleware} from '@clerk/express'
import rateLimiter from "./middleware/rateLimiter.ts";
import authRoute from "./routes/authRoute.ts"


const app = express();

//middleware
app.use(rateLimiter);
app.use(express.json());
app.use(clerkMiddleware());
app.use("/api/auth", authRoute);
// app.use("/api/protected/fridge")


export default app;