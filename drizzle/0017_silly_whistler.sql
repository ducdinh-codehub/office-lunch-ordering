ALTER TABLE "app_settings" ADD COLUMN "header_banner_image_id" uuid;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "billing_banner_image_id" uuid;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "footer_banner_image_id" uuid;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_header_banner_image_id_email_images_id_fk" FOREIGN KEY ("header_banner_image_id") REFERENCES "public"."email_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_billing_banner_image_id_email_images_id_fk" FOREIGN KEY ("billing_banner_image_id") REFERENCES "public"."email_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_footer_banner_image_id_email_images_id_fk" FOREIGN KEY ("footer_banner_image_id") REFERENCES "public"."email_images"("id") ON DELETE set null ON UPDATE no action;