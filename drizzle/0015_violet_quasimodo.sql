CREATE TYPE "public"."email_run_trigger" AS ENUM('now', 'cron');--> statement-breakpoint
CREATE TABLE "email_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"run_at" timestamp with time zone NOT NULL,
	"trigger" "email_run_trigger" NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "email_runs_job_run_unique" UNIQUE("job_id","run_at")
);
--> statement-breakpoint
ALTER TABLE "email_runs" ADD CONSTRAINT "email_runs_job_id_email_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."email_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_runs_started_idx" ON "email_runs" USING btree ("started_at");--> statement-breakpoint
-- History for runs before this table existed. "Gửi ngay" jobs are created
-- already due, so a first run within seconds of creation was the admin's;
-- anything else was the timer. Skipped counts were never kept, so they are 0.
INSERT INTO "email_runs" ("job_id", "run_at", "trigger", "started_at", "finished_at", "sent", "failed", "skipped")
SELECT d."job_id", d."run_at",
  CASE WHEN j."repeat" = 'none' AND abs(extract(epoch FROM j."first_run_at" - j."created_at")) < 5
    THEN 'now'::"email_run_trigger" ELSE 'cron'::"email_run_trigger" END,
  min(d."created_at"), max(d."created_at"),
  count(*) FILTER (WHERE d."status" = 'sent'), count(*) FILTER (WHERE d."status" = 'failed'), 0
FROM "email_deliveries" d JOIN "email_jobs" j ON j."id" = d."job_id"
GROUP BY d."job_id", d."run_at", j."repeat", j."first_run_at", j."created_at";
--> statement-breakpoint
-- One-time jobs that ran but emailed nobody (a reminder when nobody owed).
INSERT INTO "email_runs" ("job_id", "run_at", "trigger", "started_at", "finished_at")
SELECT j."id", j."first_run_at",
  CASE WHEN abs(extract(epoch FROM j."first_run_at" - j."created_at")) < 5
    THEN 'now'::"email_run_trigger" ELSE 'cron'::"email_run_trigger" END,
  j."last_run_at", j."last_run_at"
FROM "email_jobs" j
WHERE j."last_run_at" IS NOT NULL AND j."repeat" = 'none'
  AND NOT EXISTS (SELECT 1 FROM "email_deliveries" d WHERE d."job_id" = j."id");
