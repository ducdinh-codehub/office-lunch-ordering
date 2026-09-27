CREATE TABLE "lucky_envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"percent" integer NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lucky_envelopes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "lucky_envelopes_percent_check" CHECK ("lucky_envelopes"."percent" in (5, 10, 20))
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "lucky_envelope_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lucky_envelopes" ADD CONSTRAINT "lucky_envelopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lucky_envelopes_date_idx" ON "lucky_envelopes" USING btree ("service_date");