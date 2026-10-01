import Link from "next/link";

import { EmailComposer } from "@/components/admin/email-composer";
import { ScheduledEmails } from "@/components/admin/scheduled-emails";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmailMembers, getRecentEmailRuns, getScheduledEmailJobs } from "@/db/queries/emails";
import { serverEnv } from "@/env";
import { pageTitle } from "@/lib/app-name";
import { requireAdmin } from "@/lib/auth/session";
import { formatInstant, shiftServiceDate, todayServiceDate } from "@/lib/date";
import { isEmailConfigured } from "@/lib/email/mailer";
import { EMAIL_KIND_LABEL, emailAudienceText, emailJobTitle } from "@/lib/email/labels";
import { REPEAT_LABEL } from "@/lib/email/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Email") };

export default async function AdminEmailsPage() {
  await requireAdmin();
  const [members, scheduled, runs] = await Promise.all([
    getEmailMembers(),
    getScheduledEmailJobs(),
    getRecentEmailRuns(),
  ]);

  const configured = isEmailConfigured();
  const redirectTo = serverEnv.emailRedirectTo;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
        <p className="text-muted-foreground text-sm">
          Gửi email nhắc nợ hoặc thông báo cho mọi người — gửi ngay, hẹn giờ, hoặc lặp lại định kỳ.
        </p>
      </div>

      {(!configured || redirectTo) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {!configured &&
            (process.env.NODE_ENV === "production"
              ? "Chưa cấu hình máy chủ gửi email (SMTP) nên chưa gửi được email."
              : "Chưa cấu hình SMTP — email chỉ được in ra console của máy chủ, không gửi thật.")}
          {configured && redirectTo && (
            <>
              Đang ở chế độ thử: mọi email được chuyển hết về <strong>{redirectTo}</strong>.
            </>
          )}
        </div>
      )}

      <EmailComposer
        members={members}
        defaultScheduleAt={`${shiftServiceDate(todayServiceDate(), 1)}T08:00`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đã hẹn giờ</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduledEmails
            jobs={scheduled.map((job) => ({
              id: job.id,
              kindLabel: EMAIL_KIND_LABEL[job.kind],
              title: emailJobTitle(job),
              recipients: emailAudienceText(job),
              nextRun: job.nextRunAt ? formatInstant(job.nextRunAt) : "—",
              repeatLabel: job.repeat === "none" ? null : REPEAT_LABEL[job.repeat],
            }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đã gửi gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa gửi email nào.</p>
          ) : (
            <ul className="divide-y">
              {runs.map((run) => (
                <li
                  key={`${run.jobId}:${run.runAt.getTime()}`}
                  className="space-y-1 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{EMAIL_KIND_LABEL[run.kind]}</Badge>
                    <Link
                      href={`/admin/emails/${run.jobId}`}
                      className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {emailJobTitle(run)}
                    </Link>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatInstant(run.runAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Đã gửi {run.sent}
                    {run.pending > 0 && ` · đang gửi ${run.pending}`}
                    {run.failed > 0 && (
                      <span className="text-destructive"> · lỗi {run.failed}</span>
                    )}
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
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
