import {db} from "../config/db.ts";
import {eq, asc} from "drizzle-orm";
import {fridgeTable, profilesTable} from "../db/schema.ts";

export const getFridgeItems = async (userId: string) => {
    const [user] = await db.select().from(profilesTable).where(eq(profilesTable.clerk_id, userId));
    if (!user?.household_id) return null;

    return db
        .select()
        .from(fridgeTable)
        .where(eq(fridgeTable.household_id, user.household_id))
        .orderBy(asc(fridgeTable.expires_at));
}