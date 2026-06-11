import express from 'express';
import {clerkMiddleware} from '@clerk/express'
import rateLimiter from "./middleware/rateLimiter.ts";
import authRoute from "./routes/authRoute.ts"
import fridgeRoute from "./routes/fridgeRoute.ts"


const app = express();

//middleware
app.use(express.json({limit: '20mb'}));
app.use(express.urlencoded({extended: true, limit: '20mb'}));
app.use(clerkMiddleware());
//app.use(rateLimiter);
app.use("/api/auth", authRoute);
app.use("/api/fridge", fridgeRoute)
// app.use("/api/protected/fridge")


export default app;