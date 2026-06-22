ALTER TABLE "shopping" ALTER COLUMN "quantity" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "shopping" ALTER COLUMN "unit" SET DATA TYPE "public"."unit" USING "unit"::"public"."unit";--> statement-breakpoint
ALTER TABLE "shopping" ADD COLUMN "unit_type" "unit_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "shopping" ADD COLUMN "emoji" varchar(10) NOT NULL;