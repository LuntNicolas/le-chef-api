import {jsonb, pgTable, varchar, uuid, timestamp} from "drizzle-orm/pg-core";

export const householdsTable = pgTable("households", {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({length: 256}).notNull(),
    invite_code: varchar({length: 256}).unique().notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
})

export const profilesTable = pgTable("profiles", {
    user_id: uuid().primaryKey().defaultRandom(),
    clerk_id: varchar({length: 256}).notNull(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    name: varchar({length: 256}).notNull(),
    email: varchar({length: 256}).notNull(),
    dietary_prefs: jsonb(),
    created_at: timestamp("created_at").defaultNow().notNull(),
})

// export const createTables = async () => {
//     await sql`CREATE TABLE IF NOT EXISTS households
//     (
//         id
//         UUID
//         PRIMARY
//         KEY
//         DEFAULT
//         gen_random_uuid
//               (
//               ),
//         name VARCHAR
//               (
//                   255
//               ) NOT NULL,
//         invite_code VARCHAR
//               (
//                   255
//               ) UNIQUE NOT NULL,
//         created_at TIMESTAMP
//         )`;
//
//     await sql`CREATE TABLE IF NOT EXISTS profiles
//     (
//         user_id
//         UUID
//         PRIMARY
//         KEY
//         DEFAULT
//         gen_random_uuid
//               (
//               ),
//         clerk_id VARCHAR
//               (
//                   255
//               ) UNIQUE NOT NULL,
//         household_id UUID,
//         CONSTRAINT fk_household_id
//         FOREIGN KEY
//               (
//                   household_id
//               ) REFERENCES households
//               (
//                   id
//               ),
//         name VARCHAR
//               (
//                   255
//               ) NOT NULL,
//         email
//         VARCHAR
//               (
//                   255
//               ) NOT NULL,
//         dietary_prefs JSONB,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//         )`;
//
// }