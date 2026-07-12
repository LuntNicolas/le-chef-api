import express from 'express';
import {clerkMiddleware} from '@clerk/express'
import rateLimiter from "./middleware/rateLimiter.ts";
import authRoute from "./routes/authRoute.ts"
import fridgeRoute from "./routes/fridgeRoute.ts"
import recipeRoute from "./routes/recipeRoute.ts"
import groceryRoute from "./routes/groceryRoute.ts"
import demoRoute from "./routes/demoRoute.ts"

const app = express();

//middleware
app.use(express.json({limit: '20mb'}));
app.use(express.urlencoded({extended: true, limit: '20mb'}));

// public, unauthenticated — uptime checks and the read-only demo
app.get("/health", (_req, res) => res.status(200).json({status: "ok"}));
app.use("/api/demo", demoRoute);

app.use(clerkMiddleware());
//app.use(rateLimiter);
app.use("/api/auth", authRoute);
app.use("/api/fridge", fridgeRoute)
app.use("/api/recipe", recipeRoute)
app.use("/api/grocery", groceryRoute)


export default app;
