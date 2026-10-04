/**
 * The two emails, as HTML plus a plain-text twin. Mail filters trust a message
 * that carries both, and a plain one reads fine in any client.
 *
 * Inline styles only — mail clients ignore stylesheets. Names are escaped; the
 * admin's message is editor HTML, sanitised again here before it is used.
 */
import "server-only";

import { APP_NAME, APP_SHORT_NAME } from "@/lib/app-name";
import { formatServiceDate, type ServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { DEFAULT_BILLING_TEMPLATE } from "./billing-template";
import {
  NO_BANNERS,
  type EmailBanners,
  htmlToPlainText,
  isEmptyEmailHtml,
  sanitizeEmailHtml,
  styleForEmail,
} from "./content";

export type RenderedEmail = { subject: string; html: string; text: string };

export type BillingLine = { serviceDate: ServiceDate; owedVnd: number };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The admin's message, ready to sit inside the email. */
function messageHtml(html: string): string {
  return styleForEmail(sanitizeEmailHtml(html));
}


function layout(
  content: string,
  footer: string,
  banners: EmailBanners,
): string {
  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px 12px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;font-size:15px;line-height:1.55">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">
${banners.header ? `<img src="${escapeHtml(banners.header)}" width="560" alt="${escapeHtml(APP_SHORT_NAME)}" style="display:block;width:100%;max-width:560px;height:auto;border:0">` : ""}
<div style="padding:24px">
${content}
</div>
${banners.footer ? `<img src="${escapeHtml(banners.footer)}" width="560" alt="" style="display:block;width:100%;max-width:560px;height:auto;border:0">` : ""}
</div>
<p style="max-width:560px;margin:12px auto 0;color:#78716c;font-size:12px;line-height:1.5">${footer}</p>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:20px 0 4px"><a href="${escapeHtml(href)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

/** A placeholder's whole paragraph, so the table is not nested inside a <p>. */
const TABLE_PARAGRAPH = /<p\b[^>]*>\s*\{\{bang_ngay_no\}\}\s*<\/p>/g;

/**
 * One person's billing email: the admin's template (see billing-template.ts)
 * with that person's figures put in, then the pay button. A template with no
 * words left falls back to the default rather than sending a bare button.
 */
export function renderBillingEmail({
  name,
  lines,
  template,
  appUrl,
  banners = NO_BANNERS,
}: {
  name: string;
  lines: BillingLine[];
  template: string;
  appUrl: string;
  banners?: EmailBanners;
}): RenderedEmail {
  const total = lines.reduce((sum, line) => sum + line.owedVnd, 0);
  // Oldest first, the order a person settles them in.
  const sorted = [...lines].sort((a, b) => (a.serviceDate < b.serviceDate ? -1 : 1));
  const payUrl = `${appUrl}/me/payments`;
  const words = isEmptyEmailHtml(template) ? DEFAULT_BILLING_TEMPLATE : template;

  const rows = sorted
    .map(
      (line) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #f5f5f4">${escapeHtml(formatServiceDate(line.serviceDate))}</td><td style="padding:6px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap">${formatVnd(line.owedVnd)}</td></tr>`,
    )
    .join("");
  const table = `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 12px">${rows}
<tr><td style="padding:10px 0 0;font-weight:600">Tổng cộng</td><td style="padding:10px 0 0;text-align:right;font-weight:600;white-space:nowrap">${formatVnd(total)}</td></tr></table>`;

  // Figures go in after sanitising: the template is the admin's HTML, the
  // values are ours — the name escaped, the table built here.
  const fill = (value: string) =>
    value
      .replaceAll("{{ten}}", escapeHtml(name))
      .replaceAll("{{tong_tien}}", formatVnd(total))
      .replaceAll("{{so_ngay}}", String(sorted.length));
  const content = fill(messageHtml(words))
    .replace(TABLE_PARAGRAPH, table)
    .replaceAll("{{bang_ngay_no}}", table);

  const html = layout(
    `${content}
${button(payUrl, "Thanh toán")}
<p style="margin:8px 0 0;color:#78716c;font-size:13px">Mã QR ở trang thanh toán đã điền sẵn số tiền và nội dung chuyển khoản.</p>`,
    `Email nhắc thanh toán từ ${escapeHtml(APP_NAME)}. Số tiền tính đến lúc gửi; nếu bạn vừa chuyển khoản, có thể bỏ qua email này.`,
    banners,
  );

  const tableText = [
    ...sorted.map((line) => `- ${formatServiceDate(line.serviceDate)}: ${formatVnd(line.owedVnd)}`),
    `Tổng cộng: ${formatVnd(total)}`,
  ].join("\n");
  const text = [
    htmlToPlainText(words)
      .replaceAll("{{ten}}", name)
      .replaceAll("{{tong_tien}}", formatVnd(total))
      .replaceAll("{{so_ngay}}", String(sorted.length))
      .replaceAll("{{bang_ngay_no}}", tableText),
    "",
    `Thanh toán: ${payUrl}`,
    "",
    `— ${APP_SHORT_NAME}`,
  ].join("\n");

  return { subject: `Tiền cơm: bạn còn ${formatVnd(total)} chưa thanh toán`, html, text };
}

/**
 * A notice is the admin's own words, greeting included — nothing is put in
 * front of them, so the email opens however the admin chose to open it.
 */
export function renderNoticeEmail({
  subject,
  body,
  appUrl,
  banners = NO_BANNERS,
}: {
  subject: string;
  body: string;
  appUrl: string;
  banners?: EmailBanners;
}): RenderedEmail {
  const profileUrl = `${appUrl}/me/profile`;

  const html = layout(
    `${messageHtml(body)}
${button(appUrl, `Mở ${APP_SHORT_NAME}`)}`,
    `Thông báo từ ${escapeHtml(APP_NAME)}. Không muốn nhận thông báo? <a href="${escapeHtml(profileUrl)}" style="color:#78716c">Tắt trong Hồ sơ</a>.`,
    banners,
  );

  const text = [
    htmlToPlainText(body),
    "",
    appUrl,
    "",
    `— ${APP_SHORT_NAME}`,
    `Không muốn nhận thông báo? Tắt trong Hồ sơ: ${profileUrl}`,
  ].join("\n");

  return { subject, html, text };
}
