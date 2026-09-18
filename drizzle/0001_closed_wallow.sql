CREATE TYPE "public"."menu_item_category" AS ENUM('main', 'side', 'veg', 'addon', 'drink');--> statement-breakpoint
CREATE TABLE "day_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"menu_day_id" uuid NOT NULL,
	"set_price_vnd" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "day_orders_user_day_unique" UNIQUE("user_id","menu_day_id")
);
--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "set_price_vnd" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "required_main" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "required_side" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_days" ADD COLUMN "required_veg" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "category" "menu_item_category" DEFAULT 'addon' NOT NULL;--> statement-breakpoint
ALTER TABLE "day_orders" ADD CONSTRAINT "day_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_orders" ADD CONSTRAINT "day_orders_menu_day_id_menu_days_id_fk" FOREIGN KEY ("menu_day_id") REFERENCES "public"."menu_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_orders_day_idx" ON "day_orders" USING btree ("menu_day_id");--> statement-breakpoint
CREATE INDEX "menu_items_day_category_idx" ON "menu_items" USING btree ("menu_day_id","category");