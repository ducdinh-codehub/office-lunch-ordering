ALTER TABLE "app_settings" ADD COLUMN "welcome_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_theme" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_message" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_image_id" uuid;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_text_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_image_scale" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_border_style" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_border_width" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_border_color" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "welcome_border_radius" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_welcome_image_id_email_images_id_fk" FOREIGN KEY ("welcome_image_id") REFERENCES "public"."email_images"("id") ON DELETE set null ON UPDATE no action;