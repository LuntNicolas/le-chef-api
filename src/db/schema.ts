import {jsonb, pgTable, varchar, uuid, timestamp, integer, date, numeric, boolean, pgEnum} from "drizzle-orm/pg-core";

export const unitTypeEnum = pgEnum("unit_type", ["count", "weight", "volume"]);

export const unitEnum = pgEnum("unit", [
    "stück", "packung", "flasche", "glas", "dose", // count
    "g", "kg",                                      // weight
    "ml", "l"                                        // volume
]);

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
    quantity: numeric({precision: 10, scale: 2, mode: "number"}).notNull(), // statt integer!
    unit: unitEnum().notNull(),
    unit_type: unitTypeEnum().notNull(), // redundant, aber praktisch für Queries/Filter
    emoji: varchar({length: 10}).notNull(),
    expires_at: timestamp("expires_at"),
})

export const recipesTable = pgTable("recipes", {
    id: uuid().primaryKey().defaultRandom(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    title: varchar({length: 256}).notNull(),
    meal_type: varchar({length: 50}).notNull(),
    ingredients: jsonb().notNull(),
    steps: jsonb().notNull(),
    duration: integer().notNull(),
    date: date("date").notNull(),
})

export const shoppingTable = pgTable("shopping", {
    id: uuid().primaryKey().defaultRandom(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    recipe_id: uuid("recipe_id").references(() => recipesTable.id),
    name: varchar({length: 256}).notNull(),
    quantity: numeric().notNull(),
    unit: varchar({length: 50}).notNull(),
    purchased: boolean().notNull().default(false),
})