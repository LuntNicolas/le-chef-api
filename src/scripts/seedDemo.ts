import 'dotenv/config';
import {db} from "../config/db.ts";
import {householdsTable, fridgeTable, recipesTable, shoppingTable} from "../db/schema.ts";

// Seeds a self-contained demo household with fridge items, recipes and a
// shopping list, then prints the DEMO_HOUSEHOLD_ID to configure on the server.
// Run with: npm run seed:demo

const inDays = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const dateStr = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
};

async function main() {
    const [household] = await db.insert(householdsTable).values({
        name: "Le Chef Demo",
    }).returning();

    if (!household) throw new Error("Could not create demo household");

    const fridge = await db.insert(fridgeTable).values([
        {household_id: household.id, name: "Eier", quantity: 10, unit: "stück", unit_type: "count", emoji: "🥚", expires_at: inDays(12)},
        {household_id: household.id, name: "Milch", quantity: 1000, unit: "ml", unit_type: "volume", emoji: "🥛", expires_at: inDays(4)},
        {household_id: household.id, name: "Tomaten", quantity: 500, unit: "g", unit_type: "weight", emoji: "🍅", expires_at: inDays(3)},
        {household_id: household.id, name: "Karotten", quantity: 6, unit: "stück", unit_type: "count", emoji: "🥕", expires_at: inDays(10)},
        {household_id: household.id, name: "Joghurt", quantity: 4, unit: "stück", unit_type: "count", emoji: "🥣", expires_at: inDays(2)},
        {household_id: household.id, name: "Butter", quantity: 250, unit: "g", unit_type: "weight", emoji: "🧈", expires_at: inDays(21)},
    ]).returning();

    const byName = Object.fromEntries(fridge.map((f) => [f.name, f]));

    const shopping = await db.insert(shoppingTable).values([
        {household_id: household.id, name: "Haferflocken", quantity: 300, unit: "g", unit_type: "weight", emoji: "🥣", expires_at: inDays(30)},
        {household_id: household.id, name: "Beeren", quantity: 250, unit: "g", unit_type: "weight", emoji: "🍓", expires_at: inDays(4)},
        {household_id: household.id, name: "Parmesan", quantity: 80, unit: "g", unit_type: "weight", emoji: "🧀", expires_at: inDays(20)},
        {household_id: household.id, name: "Spaghetti", quantity: 500, unit: "g", unit_type: "weight", emoji: "🍝", expires_at: inDays(90)},
    ]).returning();

    const shoppingByName = Object.fromEntries(shopping.map((s) => [s.name, s]));

    await db.insert(recipesTable).values([
        {
            household_id: household.id,
            title: "Joghurt-Bowl mit Beeren",
            meal_type: "breakfast",
            date: dateStr(0),
            duration: 10,
            kcal: 420,
            fridge_ingredient_ids: [byName["Joghurt"]!.id],
            fridge_ingredients: [
                {id: byName["Joghurt"]!.id, name: "Joghurt", quantity: 2, unit: "stück"},
            ],
            shopping_ingredient_ids: [shoppingByName["Haferflocken"]!.id, shoppingByName["Beeren"]!.id],
            steps: [
                "Joghurt in eine Schüssel geben.",
                "Haferflocken darüber streuen.",
                "Mit Beeren toppen und servieren.",
            ],
        },
        {
            household_id: household.id,
            title: "Rührei mit Tomaten",
            meal_type: "lunch",
            date: dateStr(0),
            duration: 15,
            kcal: 520,
            fridge_ingredient_ids: [byName["Eier"]!.id, byName["Tomaten"]!.id, byName["Butter"]!.id],
            fridge_ingredients: [
                {id: byName["Eier"]!.id, name: "Eier", quantity: 4, unit: "stück"},
                {id: byName["Tomaten"]!.id, name: "Tomaten", quantity: 200, unit: "g"},
                {id: byName["Butter"]!.id, name: "Butter", quantity: 20, unit: "g"},
            ],
            shopping_ingredient_ids: [],
            steps: [
                "Tomaten würfeln.",
                "Butter in der Pfanne erhitzen, Tomaten kurz anbraten.",
                "Eier verquirlen, dazugeben und stocken lassen.",
            ],
        },
        {
            household_id: household.id,
            title: "Spaghetti mit Karotten-Tomaten-Sauce",
            meal_type: "dinner",
            date: dateStr(0),
            duration: 30,
            kcal: 680,
            fridge_ingredient_ids: [byName["Tomaten"]!.id, byName["Karotten"]!.id],
            fridge_ingredients: [
                {id: byName["Tomaten"]!.id, name: "Tomaten", quantity: 300, unit: "g"},
                {id: byName["Karotten"]!.id, name: "Karotten", quantity: 2, unit: "stück"},
            ],
            shopping_ingredient_ids: [shoppingByName["Spaghetti"]!.id, shoppingByName["Parmesan"]!.id],
            steps: [
                "Spaghetti nach Packungsanweisung kochen.",
                "Karotten fein reiben, mit gewürfelten Tomaten zu einer Sauce einkochen.",
                "Alles vermengen und mit Parmesan servieren.",
            ],
        },
        {
            household_id: household.id,
            title: "Overnight Oats",
            meal_type: "breakfast",
            date: dateStr(1),
            duration: 5,
            kcal: 380,
            fridge_ingredient_ids: [byName["Milch"]!.id],
            fridge_ingredients: [
                {id: byName["Milch"]!.id, name: "Milch", quantity: 250, unit: "ml"},
            ],
            shopping_ingredient_ids: [shoppingByName["Haferflocken"]!.id],
            steps: [
                "Haferflocken mit Milch verrühren.",
                "Über Nacht in den Kühlschrank stellen.",
            ],
        },
    ]);

    console.log("\nDemo household seeded ✔");
    console.log(`\nSet this on your server (Railway → Variables) and in .env:\n\nDEMO_HOUSEHOLD_ID=${household.id}\n`);
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
