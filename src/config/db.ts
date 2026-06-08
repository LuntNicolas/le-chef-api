// src/config/db.ts
import 'dotenv/config';
import {neon} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-http';

export const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({client: sql});