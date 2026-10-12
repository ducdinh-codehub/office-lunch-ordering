ALTER TABLE "app_settings" ADD COLUMN "welcome_map_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
-- A map link pasted at the end of the message's "Lưu trú:" line (the way it
-- was done before this column) moves here, out of the text it would now show in.
UPDATE "app_settings"
SET
  "welcome_map_url" = (regexp_match("welcome_message", 'Lưu trú([^\n]*)[[:blank:]]+(https?://[^[:space:]]+)'))[2],
  "welcome_message" = regexp_replace("welcome_message", 'Lưu trú([^\n]*)[[:blank:]]+(https?://[^[:space:]]+)', 'Lưu trú\1')
WHERE "welcome_message" ~ 'Lưu trú([^\n]*)[[:blank:]]+(https?://[^[:space:]]+)';
