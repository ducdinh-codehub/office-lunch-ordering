import "server-only";

import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  emailDeliveries,
  emailJobs,
  emailRuns,
  users,
  type EmailJob,
  type EmailRunTrigger,
} from "@/db/schema";
import { getMenuDaysForDate } from "@/db/queries/menu";
import { getDebtors, getOutstanding, type Debtor } from "@/db/queries/payments";
import { serverEnv } from "@/env";
import { shiftServiceDate, todayServiceDate } from "@/lib/date";
import { fallbackDisplayName } from "@/lib/display-name";
import { loadInlineImages, withPreviewLogo } from "./content";
import { sendEmail } from "./mailer";
import { nextOccurrence } from "./schedule";
import { renderBillingEmail, renderNoticeEmail, type RenderedEmail } from "./templates";

export type RunSummary = {
  sent: number;
  failed: number;
  /** Billing recipients who owe nothing, and anyone already sent this run. */
  skipped: number;
};

type Recipient = { id: string; email: string; name: string };

/**
 * Who a job goes to, as of now — someone who joined after it was scheduled is
 * in "everyone". Notice emails leave out those who turned them off; billing
 * emails do not, since they are about money owed.
 */
async function resolveRecipients(job: EmailJob): Promise<Recipient[]> {
  if (job.audience === "selected" && job.recipientUserIds.length === 0) return [];

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      noticeEmailsEnabled: users.noticeEmailsEnabled,
    })
    .from(users)
    .where(job.audience === "selected" ? inArray(users.id, job.recipientUserIds) : undefined)
    .orderBy(asc(users.email));

  return rows
    .filter((row) => job.kind === "billing" || row.noticeEmailsEnabled)
    .map((row) => ({
      id: row.id,
      email: row.email,
      name: row.displayName ?? fallbackDisplayName(row.email),
    }));
}

/** Who a billing email can go to right now — the composer's recipient list. */
export async function currentDebtors(): Promise<Debtor[]> {
  const today = todayServiceDate();
  return getDebtors(today, await unlockedTodayIds(today));
}

/** Today's menus still taking orders — left out of a bill, as on the home banner. */
async function unlockedTodayIds(today: string): Promise<string[]> {
  const menus = await getMenuDaysForDate(today);
  return menus.filter((menu) => menu.status !== "locked").map((menu) => menu.id);
}

/**
 * Renders one person's email, or null when there is nothing to say — a
 * billing email to someone who owes nothing is not sent.
 */
type JobContent = Pick<EmailJob, "kind" | "subject" | "body" | "showHeader" | "showFooter">;

async function renderFor(
  job: JobContent,
  recipient: Recipient,
  billingContext: { today: string; unlocked: string[] } | null,
): Promise<RenderedEmail | null> {
  const appUrl = serverEnv.appUrl;
  const banners = { header: job.showHeader, footer: job.showFooter };
  if (job.kind === "notice") {
    return renderNoticeEmail({ subject: job.subject, body: job.body, appUrl, banners });
  }
  const { today, unlocked } = billingContext!;
  const { entries, totalVnd } = await getOutstanding(recipient.id, today, unlocked);
  if (totalVnd <= 0) return null;
  return renderBillingEmail({
    name: recipient.name,
    lines: entries,
    template: job.body,
    appUrl,
    banners,
  });
}

/**
 * Sends one run of a job. Each recipient is claimed with an insert before
 * anything is sent; the unique (job, user, run) key means a second call for
 * the same run — a retried cron, two calls racing — finds the row taken and
 * sends nothing. A failure is recorded against that person and the rest
 * carry on.
 */
async function deliverRun(
  job: EmailJob,
  runAt: Date,
  trigger: EmailRunTrigger,
): Promise<RunSummary> {
  const summary: RunSummary = { sent: 0, failed: 0, skipped: 0 };
  // The history row goes in first, so a run cut off mid-way still shows —
  // without a finish time.
  const [run] = await db
    .insert(emailRuns)
    .values({ jobId: job.id, runAt, trigger })
    .onConflictDoNothing()
    .returning({ id: emailRuns.id });

  const recipients = await resolveRecipients(job);

  const today = todayServiceDate();
  const billingContext =
    job.kind === "billing" ? { today, unlocked: await unlockedTodayIds(today) } : null;
  // The same pictures go to everyone, so they are read once per run.
  const images = await loadInlineImages(job.body);

  for (const recipient of recipients) {
    const email = await renderFor(job, recipient, billingContext);
    if (!email) {
      summary.skipped += 1;
      continue;
    }

    const [claimed] = await db
      .insert(emailDeliveries)
      .values({
        jobId: job.id,
        userId: recipient.id,
        email: recipient.email,
        subject: email.subject,
        runAt,
      })
      .onConflictDoNothing()
      .returning({ id: emailDeliveries.id });
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    try {
      await sendEmail({
        to: recipient.email,
        ...email,
        ...images.prepare(email.html),
        headers:
          job.kind === "notice"
            ? { "List-Unsubscribe": `<${serverEnv.appUrl}/me/profile>` }
            : undefined,
      });
      await db
        .update(emailDeliveries)
        .set({ status: "sent" })
        .where(eq(emailDeliveries.id, claimed.id));
      summary.sent += 1;
    } catch (cause) {
      console.error("[email] send failed", recipient.email, cause);
      const message = cause instanceof Error ? cause.message : String(cause);
      await db
        .update(emailDeliveries)
        .set({ status: "failed", error: message.slice(0, 500) })
        .where(eq(emailDeliveries.id, claimed.id));
      summary.failed += 1;
    }
  }
  if (run) {
    await db
      .update(emailRuns)
      .set({ ...summary, finishedAt: new Date() })
      .where(eq(emailRuns.id, run.id));
  }
  return summary;
}

/**
 * Takes the job's current run for this caller, moving `next_run_at` on in
 * the same statement. Only one caller can match the old `next_run_at`, so a
 * run is never taken twice.
 */
async function claimRun(job: EmailJob, now: Date): Promise<Date | null> {
  const runAt = job.nextRunAt;
  if (!runAt) return null;
  const next = nextOccurrence(job.firstRunAt, job.repeat, now);

  const [claimed] = await db
    .update(emailJobs)
    .set({ nextRunAt: next, status: next ? "scheduled" : "done", lastRunAt: now })
    .where(
      and(
        eq(emailJobs.id, job.id),
        eq(emailJobs.status, "scheduled"),
        // Postgres keeps microseconds, a JS Date only milliseconds: compare at
        // the precision `runAt` was read with, or a timestamp written by SQL
        // could never be matched and its job would never run.
        sql`date_trunc('milliseconds', ${emailJobs.nextRunAt}) = ${runAt.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: emailJobs.id });
  return claimed ? runAt : null;
}

/** Runs one job immediately — what "Gửi ngay" does after creating it. */
export async function runJobNow(jobId: string): Promise<RunSummary | null> {
  const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId));
  if (!job) return null;
  const runAt = await claimRun(job, new Date());
  return runAt ? deliverRun(job, runAt, "now") : null;
}

/**
 * Every job whose time has come. Called by the cron endpoint every few
 * minutes. Stops taking new jobs near the function's time limit; whatever is
 * left is still due on the next call.
 */
export async function runDueJobs(budgetMs = 45_000): Promise<
  Array<{ jobId: string; runAt: string } & RunSummary>
> {
  const started = Date.now();
  const now = new Date();
  const due = await db
    .select()
    .from(emailJobs)
    .where(and(eq(emailJobs.status, "scheduled"), lte(emailJobs.nextRunAt, now)))
    .orderBy(asc(emailJobs.nextRunAt))
    .limit(20);

  const results = [];
  for (const job of due) {
    if (Date.now() - started > budgetMs) break;
    const runAt = await claimRun(job, now);
    if (!runAt) continue;
    results.push({ jobId: job.id, runAt: runAt.toISOString(), ...(await deliverRun(job, runAt, "cron")) });
  }
  return results;
}

/** Two made-up unpaid days, for a billing email shown to someone who owes nothing. */
export function sampleBillingLines(today: string) {
  return [
    { serviceDate: shiftServiceDate(today, -2), owedVnd: 50_000 },
    { serviceDate: shiftServiceDate(today, -1), owedVnd: 65_000 },
  ];
}

/**
 * The email as it will look for `recipient` — billing with their real debt,
 * or two sample days when they owe nothing, so the layout can always be seen.
 */
async function renderSample(job: JobContent, recipient: Recipient): Promise<RenderedEmail> {
  const today = todayServiceDate();
  const email = await renderFor(job, recipient, {
    today,
    unlocked: job.kind === "billing" ? await unlockedTodayIds(today) : [],
  });
  return (
    email ??
    renderBillingEmail({
      name: recipient.name,
      lines: sampleBillingLines(today),
      template: job.body,
      appUrl: serverEnv.appUrl,
      banners: { header: job.showHeader, footer: job.showFooter },
    })
  );
}

/**
 * The composer's live preview: the email for one recipient, as the browser
 * can show it — banners inlined, uploaded pictures left at their app URL.
 */
export async function previewEmail(
  job: JobContent,
  recipient: { id: string; email: string; displayName: string | null },
): Promise<{ subject: string; html: string; name: string }> {
  const name = recipient.displayName ?? fallbackDisplayName(recipient.email);
  const email = await renderSample(job, { id: recipient.id, email: recipient.email, name });
  return { subject: email.subject, html: withPreviewLogo(email.html), name };
}

/**
 * The admin's "Gửi thử": the email exactly as it will look, sent only to the
 * admin. A billing test uses the admin's own debt, or two sample days when
 * there is none. Nothing is recorded.
 */
export async function sendTestEmail(
  admin: { id: string; email: string; displayName: string | null },
  job: JobContent,
): Promise<void> {
  const email = await renderSample(job, {
    id: admin.id,
    email: admin.email,
    name: admin.displayName ?? fallbackDisplayName(admin.email),
  });
  const images = await loadInlineImages(job.body);
  await sendEmail({
    to: admin.email,
    ...email,
    ...images.prepare(email.html),
    subject: `[Thử] ${email.subject}`,
  });
}
