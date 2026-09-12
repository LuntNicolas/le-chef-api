import {
    jsonb,
    pgTable,
    varchar,
    uuid,
    timestamp,
    integer,
    date,
    numeric,
    boolean,
    pgEnum,
    uniqueIndex,
    unique
} from "drizzle-orm/pg-core";

export const unitEnum = pgEnum("unit", ["g", "kg", "ml", "l"]);

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
    },
    (table) => [unique("unique").on(
        table.household_id,
        table.name,
        table.expires_at
    )]
)

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
    ingridents: jsonb().notNull(),
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

export const recipesFridgeTable = pgTable("recipes_fridge", {
    id: uuid().primaryKey().defaultRandom(),
    recipe_id: uuid("recipe_id").references(() => recipesTable.id),
    fridge_id: uuid("fridge_id").references(() => fridgeTable.id),
})

export const recipesShoppingTable = pgTable("recipes_shopping", {
    id: uuid().primaryKey().defaultRandom(),
    recipe_id: uuid("recipe_id").references(() => recipesTable.id),
    shopping_id: uuid("shopping_id").references(() => shoppingTable.id),
})