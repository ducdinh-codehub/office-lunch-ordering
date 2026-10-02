import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { EmailRun } from "@/db/queries/emails";
import { formatInstant } from "@/lib/date";
import { EMAIL_KIND_LABEL, EMAIL_TRIGGER_LABEL, emailJobTitle } from "@/lib/email/labels";

/** How long a run may go unfinished before it is shown as cut off. */
const STALLED_AFTER_MS = 5 * 60_000;

/**
 * Runs of email jobs, newest first: who started each one (the admin or the
 * timer), when, and how it went. Shared by the email page and its history.
 */
export function EmailRunList({ runs, empty }: { runs: EmailRun[]; empty: string }) {
  if (runs.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  const now = Date.now();

  return (
    <ul className="divide-y">
      {runs.map((run) => {
        const stalled = !run.finishedAt && now - run.startedAt.getTime() > STALLED_AFTER_MS;
        return (
          <li key={run.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={run.trigger === "cron" ? "default" : "outline"}>
                {EMAIL_TRIGGER_LABEL[run.trigger]}
              </Badge>
              <Badge variant="secondary">{EMAIL_KIND_LABEL[run.kind]}</Badge>
              <Link
                href={`/admin/emails/${run.jobId}`}
                className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
              >
                {emailJobTitle(run)}
              </Link>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatInstant(run.startedAt)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              {run.trigger === "cron" && <>Hẹn lúc {formatInstant(run.runAt)} · </>}
              Đã gửi {run.sent}
              {run.pending > 0 && ` · đang gửi ${run.pending}`}
              {run.failed > 0 && <span className="text-destructive"> · lỗi {run.failed}</span>}
              {run.skipped > 0 &&
                ` · bỏ qua ${run.skipped}${run.kind === "billing" ? " (không nợ)" : ""}`}
              {!run.finishedAt &&
                (stalled ? (
                  <span className="text-destructive"> · bị ngắt giữa chừng</span>
                ) : (
                  " · đang chạy…"
                ))}
            </p>
            {run.failures.length > 0 && (
              <details className="text-xs">
                <summary className="text-destructive cursor-pointer">Xem lỗi</summary>
                <ul className="mt-1 space-y-0.5">
                  {run.failures.map((failure) => (
                    <li key={failure.email} className="text-muted-foreground break-all">
                      {failure.email}: {failure.error ?? "không rõ"}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
