import express from 'express';
import {sql} from "./config/db.ts";

const app = express();

const initDB = async () => {
    try {
        await sql`
        `;
    } catch (e) {
    }
}

app.get('/', (req, res) => {
    res.send('Hello 5')
})
export default app;