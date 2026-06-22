ALTER TABLE "shopping" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipes" DROP COLUMN "expires_at";