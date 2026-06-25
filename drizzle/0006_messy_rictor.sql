ALTER TABLE "recipes" ADD COLUMN "ingredients" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "fridge_ingredient_ids";--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "shopping_ingredient_ids";