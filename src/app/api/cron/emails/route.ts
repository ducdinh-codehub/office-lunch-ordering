import { timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/env";
import { runDueJobs } from "@/lib/email/runner";

export const dynamic = "force-dynamic";
// Sending is sequential; a run to the whole office takes a while over SMTP.
export const maxDuration = 60;

/**
 * Sends every scheduled email whose time has come. cron-job.org calls this
 * every 5 minutes with `Authorization: Bearer <CRON_SECRET>`.
 *
 * There is no user session here — a timer has none — so the shared secret is
 * the only thing standing between the internet and emailing the whole group.
 * Calling it more than once is harmless: a run is claimed before it is sent.
 */
export async function GET(request: Request) {
  const expected = Buffer.from(`Bearer ${serverEnv.cronSecret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const runs = await runDueJobs();
  return Response.json({ ok: true, runs });
}
