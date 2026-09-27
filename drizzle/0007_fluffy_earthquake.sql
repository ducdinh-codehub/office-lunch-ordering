CREATE TYPE "public"."menu_slot" AS ENUM('lunch', 'afternoon');--> statement-breakpoint
ALTER TABLE "menu_days" DROP CONSTRAINT "menu_days_service_date_unique";--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "slot" "menu_slot" DEFAULT 'lunch' NOT NULL;--> statement-breakpoint
CREATE INDEX "menu_days_date_idx" ON "menu_days" USING btree ("service_date");--> statement-breakpoint
ALTER TABLE "menu_days" ADD CONSTRAINT "menu_days_date_slot_unique" UNIQUE("service_date","slot");