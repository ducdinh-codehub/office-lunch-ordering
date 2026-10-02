-- A billing job's body used to be an optional note under a fixed greeting and
-- table; it is now the whole text, with placeholders for each person's
-- figures. Put the old fixed part (DEFAULT_BILLING_TEMPLATE in
-- src/lib/email/billing-template.ts) in front of every existing note, so a
-- job scheduled before this sends exactly what it did.
UPDATE "email_jobs"
SET "body" = '<p>Chào {{ten}},</p><p>Bạn còn <strong>{{tong_tien}}</strong> tiền cơm chưa thanh toán, trong {{so_ngay}} ngày:</p><p>{{bang_ngay_no}}</p>' || "body"
WHERE "kind" = 'billing' AND "body" NOT LIKE '%{{%';
