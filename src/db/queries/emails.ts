import "server-only";

import { asc, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  emailDeliveries,
  emailJobs,
  emailRuns,
  users,
  type EmailJob,
  type EmailRunTrigger,
} from "@/db/schema";
import { fallbackDisplayName } from "@/lib/display-name";

/** Everyone who can be picked as a recipient, by name. */
export async function getEmailMembers() {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      noticeEmailsEnabled: users.noticeEmailsEnabled,
    })
    .from(users)
    .orderBy(asc(users.displayName), asc(users.email));
  return rows.map((row) => ({
    id: row.id,
    name: row.displayName ?? fallbackDisplayName(row.email),
    email: row.email,
    noticeEmailsEnabled: row.noticeEmailsEnabled,
  }));
}

/** Jobs still waiting to run, soonest first. */
export async function getScheduledEmailJobs(): Promise<EmailJob[]> {
  return db
    .select()
    .from(emailJobs)
    .where(eq(emailJobs.status, "scheduled"))
    .orderBy(asc(emailJobs.nextRunAt));
}

export type EmailRun = {
  id: string;
  jobId: string;
  kind: EmailJob["kind"];
  subject: string;
  trigger: EmailRunTrigger;
  /** The occurrence it was for — for a timed email, the time it was due. */
  runAt: Date;
  startedAt: Date;
  /** Null while sending, or when the run was cut off part-way. */
  finishedAt: Date | null;
  sent: number;
  failed: number;
  pending: number;
  skipped: number;
  failures: Array<{ email: string; error: string | null }>;
};

/**
 * Every run of every job, newest first — "Gửi ngay" and the timer alike,
 * including runs that emailed nobody (a reminder when nobody owed). Sent,
 * failed and pending are counted from the deliveries themselves, so a run
 * still in progress shows where it has got to.
 */
export async function getEmailRunHistory({
  trigger,
  limit = 20,
  offset = 0,
}: {
  trigger?: EmailRunTrigger;
  limit?: number;
  offset?: number;
} = {}): Promise<{ runs: EmailRun[]; total: number }> {
  const where = trigger ? eq(emailRuns.trigger, trigger) : undefined;
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: emailRuns.id,
        jobId: emailRuns.jobId,
        kind: emailJobs.kind,
        subject: emailJobs.subject,
        trigger: emailRuns.trigger,
        runAt: emailRuns.runAt,
        startedAt: emailRuns.startedAt,
        finishedAt: emailRuns.finishedAt,
        skipped: emailRuns.skipped,
      })
      .from(emailRuns)
      .innerJoin(emailJobs, eq(emailJobs.id, emailRuns.jobId))
      .where(where)
      .orderBy(desc(emailRuns.startedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(emailRuns).where(where),
  ]);
  if (rows.length === 0) return { runs: [], total };

  const deliveries = await db
    .select({
      jobId: emailDeliveries.jobId,
      runAt: emailDeliveries.runAt,
      email: emailDeliveries.email,
      status: emailDeliveries.status,
      error: emailDeliveries.error,
    })
    .from(emailDeliveries)
    .where(inArray(emailDeliveries.jobId, [...new Set(rows.map((row) => row.jobId))]));

  const runs = rows.map((row): EmailRun => ({
    ...row,
    sent: 0,
    failed: 0,
    pending: 0,
    failures: [],
  }));
  const byKey = new Map(runs.map((run) => [`${run.jobId}:${run.runAt.getTime()}`, run]));
  for (const delivery of deliveries) {
    const run = byKey.get(`${delivery.jobId}:${delivery.runAt.getTime()}`);
    if (!run) continue;
    run[delivery.status] += 1;
    if (delivery.status === "failed") {
      run.failures.push({ email: delivery.email, error: delivery.error });
    }
  }
  return { runs, total };
}

/**
 * The people a job was addressed to by name, as they are called now. Anyone
 * deleted since is simply missing — the job still counts them.
 */
export async function getEmailRecipientNames(
  userIds: string[],
): Promise<Array<{ id: string; name: string; email: string }>> {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));
  return rows
    .map((row) => ({
      id: row.id,
      name: row.displayName ?? fallbackDisplayName(row.email),
      email: row.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

export async function getEmailJob(jobId: string): Promise<EmailJob | null> {
  const [job] = await db.select().from(emailJobs).where(eq(emailJobs.id, jobId));
  return job ?? null;
}

export type EmailDeliveryRow = {
  id: string;
  runAt: Date;
  name: string;
  email: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  error: string | null;
};

export type EmailJobRun = {
  runAt: Date;
  /** Null only for a run with deliveries but no history row. */
  trigger: EmailRunTrigger | null;
  skipped: number;
  finished: boolean;
  deliveries: EmailDeliveryRow[];
};

/**
 * Every run of a job, newest first, with each email it sent. A run that
 * emailed nobody is still listed — it has a history row and no deliveries.
 */
export async function getEmailJobRuns(jobId: string): Promise<EmailJobRun[]> {
  const history = await db.select().from(emailRuns).where(eq(emailRuns.jobId, jobId));
  const rows = await db
    .select({
      id: emailDeliveries.id,
      runAt: emailDeliveries.runAt,
      displayName: users.displayName,
      email: emailDeliveries.email,
      subject: emailDeliveries.subject,
      status: emailDeliveries.status,
      error: emailDeliveries.error,
    })
    .from(emailDeliveries)
    .innerJoin(users, eq(users.id, emailDeliveries.userId))
    .where(eq(emailDeliveries.jobId, jobId))
    .orderBy(desc(emailDeliveries.runAt), asc(users.displayName), asc(emailDeliveries.email));

  const runs = new Map<number, EmailJobRun>(
    history.map((run) => [
      run.runAt.getTime(),
      {
        runAt: run.runAt,
        trigger: run.trigger,
        skipped: run.skipped,
        finished: run.finishedAt !== null,
        deliveries: [],
      },
    ]),
  );
  for (const row of rows) {
    const key = row.runAt.getTime();
    let run = runs.get(key);
    if (!run) {
      run = { runAt: row.runAt, trigger: null, skipped: 0, finished: true, deliveries: [] };
      runs.set(key, run);
    }
    run.deliveries.push({
      id: row.id,
      runAt: row.runAt,
      name: row.displayName ?? fallbackDisplayName(row.email),
      email: row.email,
      subject: row.subject,
      status: row.status,
      error: row.error,
    });
  }
  return [...runs.values()].sort((a, b) => b.runAt.getTime() - a.runAt.getTime());
}
