CREATE TYPE "public"."unit" AS ENUM('stück', 'packung', 'flasche', 'glas', 'dose', 'g', 'kg', 'ml', 'l');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('count', 'weight', 'volume');--> statement-breakpoint
CREATE TABLE "fridge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"added_by" uuid,
	"name" varchar(256) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit" "unit" NOT NULL,
	"unit_type" "unit_type" NOT NULL,
	"emoji" varchar(10) NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" varchar(256) NOT NULL,
	"household_id" uuid,
	"dietary_prefs" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"title" varchar(256) NOT NULL,
	"meal_type" varchar(50) NOT NULL,
	"ingredients" jsonb NOT NULL,
	"steps" jsonb NOT NULL,
	"duration" integer NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"recipe_id" uuid,
	"name" varchar(256) NOT NULL,
	"quantity" numeric NOT NULL,
	"unit" varchar(50) NOT NULL,
	"purchased" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fridge" ADD CONSTRAINT "fridge_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fridge" ADD CONSTRAINT "fridge_added_by_profiles_user_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping" ADD CONSTRAINT "shopping_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping" ADD CONSTRAINT "shopping_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;