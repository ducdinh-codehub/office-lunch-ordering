import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CancelEmailButton } from "@/components/admin/scheduled-emails";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmailJob, getEmailJobRuns, getEmailRecipientNames } from "@/db/queries/emails";
import { serverEnv } from "@/env";
import { pageTitle } from "@/lib/app-name";
import { requireAdmin } from "@/lib/auth/session";
import { formatInstant, todayServiceDate } from "@/lib/date";
import { fallbackDisplayName } from "@/lib/display-name";
import {
  EMAIL_KIND_LABEL,
  EMAIL_STATUS_LABEL,
  EMAIL_TRIGGER_LABEL,
  emailAudienceText,
  emailJobTitle,
} from "@/lib/email/labels";
import { REPEAT_LABEL } from "@/lib/email/schedule";
import { emailBanners, getEmailBannerIds } from "@/lib/email/content";
import { sampleBillingLines } from "@/lib/email/runner";
import { renderBillingEmail, renderNoticeEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Chi tiết email") };

const DELIVERY_LABEL = { sent: "Đã gửi", failed: "Lỗi", pending: "Đang gửi" } as const;

export default async function EmailJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const admin = await requireAdmin();
  const { jobId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(jobId)) notFound();

  const [job, runs] = await Promise.all([getEmailJob(jobId), getEmailJobRuns(jobId)]);
  if (!job) notFound();
  const recipients =
    job.audience === "selected" ? await getEmailRecipientNames(job.recipientUserIds) : [];
  const [creator] = job.createdByUserId ? await getEmailRecipientNames([job.createdByUserId]) : [];

  // The email as a recipient sees it. A billing email differs per person, so
  // the preview uses two sample days — the note and layout are what matter.
  const name = admin.displayName ?? fallbackDisplayName(admin.email);
  const banners = emailBanners(await getEmailBannerIds(), job.kind, {
    header: job.showHeader,
    footer: job.showFooter,
  });
  const today = todayServiceDate();
  const preview =
    job.kind === "notice"
      ? renderNoticeEmail({ subject: job.subject, body: job.body, appUrl: serverEnv.appUrl, banners })
      : renderBillingEmail({
          name,
          lines: sampleBillingLines(today),
          template: job.body,
          appUrl: serverEnv.appUrl,
          banners,
        });

  const totals = runs
    .flatMap((run) => run.deliveries)
    .reduce(
      (sum, delivery) => ({ ...sum, [delivery.status]: sum[delivery.status] + 1 }),
      { sent: 0, failed: 0, pending: 0 },
    );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/admin/emails"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Email
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{EMAIL_KIND_LABEL[job.kind]}</Badge>
          <Badge variant={job.status === "cancelled" ? "destructive" : "outline"}>
            {EMAIL_STATUS_LABEL[job.status]}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{emailJobTitle(job)}</h1>
      </div>

      <Card>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-muted-foreground text-xs">Người nhận</p>
            {recipients.length === 0 ? (
              <p>{emailAudienceText(job)}</p>
            ) : (
              <>
                <p>{emailAudienceText(job)}:</p>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {recipients.map((recipient) => (
                    <li key={recipient.id}>
                      <Badge variant="outline" className="max-w-full">
                        <span className="truncate">{recipient.name}</span>
                        <span className="text-muted-foreground truncate font-normal">
                          {recipient.email}
                        </span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <Detail label="Lặp lại">{REPEAT_LABEL[job.repeat]}</Detail>
          <Detail label="Banner">
            {[job.showHeader && "đầu email", job.showFooter && "cuối email"].filter(Boolean).join(", ") ||
              "không có"}
          </Detail>
          <Detail label="Tạo bởi">
            {creator ? `${creator.name} (${creator.email})` : "không rõ"}
          </Detail>
          <Detail label="Tạo lúc">{formatInstant(job.createdAt)}</Detail>
          <Detail label="Gửi lần đầu">{formatInstant(job.firstRunAt)}</Detail>
          {job.nextRunAt && <Detail label="Lần gửi tới">{formatInstant(job.nextRunAt)}</Detail>}
          <Detail label="Tổng đã gửi">
            {totals.sent} email
            {totals.failed > 0 && <span className="text-destructive"> · {totals.failed} lỗi</span>}
          </Detail>
          {job.status === "scheduled" && (
            <div className="sm:col-span-2">
              <CancelEmailButton
                jobId={job.id}
                label={job.repeat === "none" ? "Huỷ email hẹn giờ" : "Dừng lặp lại"}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nội dung</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            <span className="text-muted-foreground">Tiêu đề: </span>
            <span className="font-medium">{preview.subject}</span>
          </p>
          {job.kind === "billing" && (
            <p className="text-muted-foreground text-xs">
              Ví dụ với 2 ngày mẫu — mỗi người nhận thấy các ngày và số tiền của riêng họ.
            </p>
          )}
          {/* The email's own HTML, sanitised. No scripts are allowed in the
              frame; same-origin only so uploaded pictures load for the admin. */}
          <iframe
            title="Xem trước email"
            srcDoc={preview.html}
            sandbox="allow-same-origin allow-popups"
            className="h-[560px] w-full rounded-lg border bg-white"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Các lần gửi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {job.status === "scheduled" ? "Chưa đến giờ gửi." : "Không có email nào được gửi."}
            </p>
          ) : (
            runs.map((run) => (
              <section key={run.runAt.getTime()} className="space-y-2">
                <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium tabular-nums">
                  {run.trigger && (
                    <Badge variant={run.trigger === "cron" ? "default" : "outline"}>
                      {EMAIL_TRIGGER_LABEL[run.trigger]}
                    </Badge>
                  )}
                  {formatInstant(run.runAt)}
                  <span className="text-muted-foreground font-normal">
                    · {run.deliveries.length} người
                    {run.skipped > 0 &&
                      ` · bỏ qua ${run.skipped}${job.kind === "billing" ? " (không nợ)" : ""}`}
                  </span>
                </h3>
                {run.deliveries.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border px-3 py-2 text-sm">
                    {!run.finished
                      ? "Đang chạy hoặc bị ngắt giữa chừng — chưa gửi email nào."
                      : job.kind === "billing"
                        ? "Không gửi email nào — không ai trong danh sách còn nợ lúc đó."
                        : "Không gửi email nào — không có người nhận nào lúc đó."}
                  </p>
                ) : (
                <ul className="divide-y rounded-lg border">
                  {run.deliveries.map((delivery) => (
                    <li key={delivery.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate text-sm">{delivery.name}</p>
                        <p className="text-muted-foreground truncate text-xs">{delivery.email}</p>
                        {job.kind === "billing" && delivery.subject && (
                          <p className="text-muted-foreground text-xs">{delivery.subject}</p>
                        )}
                        {delivery.error && (
                          <p className="text-destructive text-xs break-all">{delivery.error}</p>
                        )}
                      </div>
                      <Badge
                        variant={
                          delivery.status === "failed"
                            ? "destructive"
                            : delivery.status === "sent"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {DELIVERY_LABEL[delivery.status]}
                      </Badge>
                    </li>
                  ))}
                </ul>
                )}
              </section>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p>{children}</p>
    </div>
  );
}
