// src/config/db.ts
import 'dotenv/config';
import {drizzle} from 'drizzle-orm/node-postgres';

export const db = drizzle(process.env.DATABASE_URL!);