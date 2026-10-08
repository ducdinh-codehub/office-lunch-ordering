CREATE TABLE "manual_bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_vnd" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "manual_bill_items_quantity_check" CHECK ("manual_bill_items"."quantity" between 1 and 99),
	CONSTRAINT "manual_bill_items_price_check" CHECK ("manual_bill_items"."unit_price_vnd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "manual_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"service_time" time,
	"title" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_bill_items" ADD CONSTRAINT "manual_bill_items_bill_id_manual_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."manual_bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_bills" ADD CONSTRAINT "manual_bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_bills" ADD CONSTRAINT "manual_bills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_bill_items_bill_idx" ON "manual_bill_items" USING btree ("bill_id");--> statement-breakpoint
CREATE INDEX "manual_bills_user_date_idx" ON "manual_bills" USING btree ("user_id","service_date");