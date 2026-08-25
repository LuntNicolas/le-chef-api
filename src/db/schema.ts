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
    household_size: integer("household_size").notNull().default(2),
    created_at: timestamp("created_at").defaultNow().notNull(),
})

export const fridgeTable = pgTable("fridge", {
    id: uuid().primaryKey().defaultRandom(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    added_by: uuid("added_by").references(() => profilesTable.user_id),
    name: varchar({length: 256}).notNull(),
    quantity: numeric({precision: 10, scale: 2, mode: "number"}).notNull(), // statt integer!
    unit: unitEnum().notNull(),
    expires_at: timestamp("expires_at"),
})

export const recipesTable = pgTable("recipes", {
    id: uuid().primaryKey().defaultRandom(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    title: varchar({length: 256}).notNull(),
    servings: integer().notNull().default(1),
    meal_type: varchar({length: 50}).notNull(),
    steps: jsonb().notNull(),
    duration: integer().notNull(),
    date: date("date").notNull(),
    kcal: integer().notNull().default(0),
})

export const shoppingTable = pgTable("shopping", {
    id: uuid().primaryKey().defaultRandom(),
    household_id: uuid("household_id").references(() => householdsTable.id),
    recipe_id: uuid("recipe_id").references(() => recipesTable.id),
    name: varchar({length: 256}).notNull(),
    quantity: numeric({precision: 10, scale: 2, mode: "number"}).notNull(), // statt integer!
    unit: unitEnum().notNull(),
    purchased: boolean().notNull().default(false),
    expires_at: timestamp("expires_at"),
})

const recipesFridgeTable = pgTable("recipes_fridge", {
    id: uuid().primaryKey().defaultRandom(),
    recipe_id: uuid("recipe_id").references(() => recipesTable.id),
    fridge_id: uuid("fridge_id").references(() => fridgeTable.id),
})

const recipesShoppingTable = pgTable("recipes_shopping", {
    id: uuid().primaryKey().defaultRandom(),
    recipe_id: uuid("recipe_id").references(() => recipesTable.id),
    shopping_id: uuid("shopping_id").references(() => shoppingTable.id),
})