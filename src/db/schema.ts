import {jsonb, pgTable, varchar, uuid, timestamp, integer} from "drizzle-orm/pg-core";

export const householdsTable = pgTable("households", {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({length: 256}).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
})

export const profilesTable = pgTable("profiles", {
    user_id: uuid().primaryKey().defaultRandom(),
    clerk_id: varchar({length: 256}).notNull(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    dietary_prefs: jsonb(),
    created_at: timestamp("created_at").defaultNow().notNull(),
})

export const fridgeTable = pgTable("fridge", {
    id: uuid().primaryKey().defaultRandom(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    added_by: uuid("added_by").references(() => profilesTable.user_id),
    name: varchar({length: 256}).notNull(),
    quantity: integer().notNull(),
    unit: varchar({length: 256}).notNull(),
    emoji: varchar({length: 10}).notNull(),
    expires_at: timestamp("expires_at"),
})