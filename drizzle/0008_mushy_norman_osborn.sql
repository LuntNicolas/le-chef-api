ALTER TABLE "recipes" ADD COLUMN "fridge_ingredient_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "shopping_ingredient_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "ingredients";