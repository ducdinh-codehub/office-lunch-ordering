import Link from "next/link";

import { EmailComposer } from "@/components/admin/email-composer";
import { EmailRunList } from "@/components/admin/email-run-list";
import { ScheduledEmails } from "@/components/admin/scheduled-emails";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getEmailJob,
  getEmailMembers,
  getEmailRunHistory,
  getScheduledEmailJobs,
} from "@/db/queries/emails";
import { serverEnv } from "@/env";
import { pageTitle } from "@/lib/app-name";
import { requireAdmin } from "@/lib/auth/session";
import { formatInstant, shiftServiceDate, todayServiceDate } from "@/lib/date";
import { isEmailConfigured } from "@/lib/email/mailer";
import { EMAIL_KIND_LABEL, emailAudienceText, emailJobTitle } from "@/lib/email/labels";
import { getEmailBannerIds } from "@/lib/email/content";
import { currentDebtors } from "@/lib/email/runner";
import { REPEAT_LABEL } from "@/lib/email/schedule";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Email") };

export default async function AdminEmailsPage({
  searchParams,
}: {
  /** `tu` names an earlier job whose words seed the composer — "Dùng lại nội dung". */
  searchParams: Promise<{ tu?: string }>;
}) {
  await requireAdmin();
  const { tu } = await searchParams;
  const [members, debtors, scheduled, history, bannerIds, source] = await Promise.all([
    getEmailMembers(),
    currentDebtors(),
    getScheduledEmailJobs(),
    getEmailRunHistory({ limit: 10 }),
    getEmailBannerIds(),
    tu && /^[0-9a-f-]{36}$/.test(tu) ? getEmailJob(tu) : null,
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

      {/* Keyed on the source so following another "Dùng lại" link starts over. */}
      <EmailComposer
        key={source?.id ?? "new"}
        initial={
          source
            ? {
                kind: source.kind,
                subject: source.subject,
                body: source.body,
                banners: { header: source.showHeader, footer: source.showFooter },
                title: emailJobTitle(source),
              }
            : null
        }
        members={members}
        debtors={debtors}
        uploadedBanners={{
          header: Boolean(bannerIds.header),
          billing: Boolean(bannerIds.billing),
          footer: Boolean(bannerIds.footer),
        }}
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
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Đã gửi gần đây</CardTitle>
          {history.total > 0 && (
            <Link
              href="/admin/emails/history"
              className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
            >
              Xem toàn bộ lịch sử ({history.total})
            </Link>
          )}
        </CardHeader>
        <CardContent>
          <EmailRunList runs={history.runs} empty="Chưa gửi email nào." />
        </CardContent>
      </Card>
    </div>
  );
}
