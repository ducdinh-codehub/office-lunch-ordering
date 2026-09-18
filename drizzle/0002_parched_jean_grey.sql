ALTER TABLE "app_settings" ADD COLUMN "default_ship_fee_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "ship_fee_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "ship_diner_count" integer;