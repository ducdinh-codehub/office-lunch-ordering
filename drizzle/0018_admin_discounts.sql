CREATE TABLE "admin_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"percent" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_discounts_user_date_unique" UNIQUE("user_id","service_date"),
	CONSTRAINT "admin_discounts_percent_check" CHECK ("admin_discounts"."percent" between 1 and 100)
);
--> statement-breakpoint
ALTER TABLE "admin_discounts" ADD CONSTRAINT "admin_discounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_discounts_date_idx" ON "admin_discounts" USING btree ("service_date");