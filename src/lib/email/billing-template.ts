/**
 * The words of a billing email, which the admin edits like any other body.
 * Each person's figures go in through placeholders, filled at send time by
 * `renderBillingEmail()`. Shared with the composer, which starts from the
 * default and lists the placeholders.
 *
 * The pay button and the QR note below it are not part of the template: they
 * are how a person acts on the email, so they are always there.
 */

export const BILLING_PLACEHOLDERS = [
  { token: "{{ten}}", label: "Tên người nhận" },
  { token: "{{tong_tien}}", label: "Tổng số tiền còn nợ" },
  { token: "{{so_ngay}}", label: "Số ngày chưa trả" },
  { token: "{{bang_ngay_no}}", label: "Bảng các ngày chưa trả" },
] as const;

/**
 * What every billing email said before it could be edited. A migration
 * (0016) writes the same HTML in front of older jobs' notes — keep the two in
 * step if this changes.
 */
export const DEFAULT_BILLING_TEMPLATE =
  "<p>Chào {{ten}},</p>" +
  "<p>Bạn còn <strong>{{tong_tien}}</strong> tiền cơm chưa thanh toán, trong {{so_ngay}} ngày:</p>" +
  "<p>{{bang_ngay_no}}</p>";
