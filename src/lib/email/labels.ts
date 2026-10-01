import type { EmailJob } from "@/db/schema";

export const EMAIL_KIND_LABEL: Record<EmailJob["kind"], string> = {
  billing: "Nhắc nợ",
  notice: "Thông báo",
};

export const EMAIL_STATUS_LABEL: Record<EmailJob["status"], string> = {
  scheduled: "Đang hẹn giờ",
  done: "Đã gửi",
  cancelled: "Đã huỷ",
};

/** What a job is called in lists: a notice by its subject, billing by its purpose. */
export function emailJobTitle(job: Pick<EmailJob, "kind" | "subject">): string {
  return job.kind === "billing" ? "Nhắc thanh toán tiền cơm" : job.subject;
}

/** Who a job goes to, in words. */
export function emailAudienceText(
  job: Pick<EmailJob, "kind" | "audience" | "recipientUserIds">,
): string {
  if (job.audience === "selected") return `${job.recipientUserIds.length} người đã chọn`;
  return job.kind === "billing" ? "mọi người đang nợ" : "tất cả mọi người";
}
