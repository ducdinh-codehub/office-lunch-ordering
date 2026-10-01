import "server-only";

import { asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { emailDeliveries, emailJobs, users, type EmailJob } from "@/db/schema";
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
  jobId: string;
  kind: EmailJob["kind"];
  subject: string;
  runAt: Date;
  sent: number;
  failed: number;
  pending: number;
  failures: Array<{ email: string; error: string | null }>;
};

/**
 * Recent runs, newest first: one entry per run of a job, with how many went
 * out. A run where nobody was emailed (a billing reminder when nobody owed)
 * has no deliveries and so does not appear.
 */
export async function getRecentEmailRuns(limit = 20): Promise<EmailRun[]> {
  // Cancelled jobs included: a repeating email stopped later still sent before.
  const jobs = await db
    .select()
    .from(emailJobs)
    .where(isNotNull(emailJobs.lastRunAt))
    .orderBy(desc(emailJobs.lastRunAt))
    .limit(limit);
  const ran = jobs.filter((job) => job.lastRunAt !== null);
  if (ran.length === 0) return [];

  const rows = await db
    .select({
      jobId: emailDeliveries.jobId,
      runAt: emailDeliveries.runAt,
      email: emailDeliveries.email,
      status: emailDeliveries.status,
      error: emailDeliveries.error,
    })
    .from(emailDeliveries)
    .where(
      inArray(
        emailDeliveries.jobId,
        ran.map((job) => job.id),
      ),
    );

  const jobById = new Map(ran.map((job) => [job.id, job]));
  const runs = new Map<string, EmailRun>();
  for (const row of rows) {
    const key = `${row.jobId}:${row.runAt.getTime()}`;
    let run = runs.get(key);
    if (!run) {
      const job = jobById.get(row.jobId)!;
      run = {
        jobId: row.jobId,
        kind: job.kind,
        subject: job.subject,
        runAt: row.runAt,
        sent: 0,
        failed: 0,
        pending: 0,
        failures: [],
      };
      runs.set(key, run);
    }
    run[row.status] += 1;
    if (row.status === "failed") run.failures.push({ email: row.email, error: row.error });
  }

  return [...runs.values()]
    .sort((a, b) => b.runAt.getTime() - a.runAt.getTime())
    .slice(0, limit);
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

/** Every email a job sent, grouped by run, newest run first. */
export async function getEmailJobRuns(
  jobId: string,
): Promise<Array<{ runAt: Date; deliveries: EmailDeliveryRow[] }>> {
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

  const runs = new Map<number, { runAt: Date; deliveries: EmailDeliveryRow[] }>();
  for (const row of rows) {
    const key = row.runAt.getTime();
    let run = runs.get(key);
    if (!run) {
      run = { runAt: row.runAt, deliveries: [] };
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
  return [...runs.values()];
}
