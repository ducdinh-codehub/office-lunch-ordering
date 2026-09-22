CREATE TYPE "public"."set_tier" AS ENUM('full', 'alt');--> statement-breakpoint
ALTER TABLE "day_orders" ADD COLUMN "set_tier" "set_tier" DEFAULT 'full' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "alt_set_price_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "alt_required_main" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "alt_required_side" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "alt_required_veg" integer DEFAULT 0 NOT NULL;