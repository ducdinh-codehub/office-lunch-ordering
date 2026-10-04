"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { emailImages, emailJobs, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { localInputToInstant } from "@/lib/date";
import { EMAIL_IMAGE_PATH, isEmptyEmailHtml, sanitizeEmailHtml } from "@/lib/email/content";
import { EMAIL_BODY_MAX, EMAIL_IMAGE_MAX_BYTES, SUBJECT_MAX } from "@/lib/email/limits";
import { sniffImageType } from "@/lib/image-type";
import { DEFAULT_BILLING_TEMPLATE } from "@/lib/email/billing-template";
import { previewEmail, runJobNow, sendTestEmail, type RunSummary } from "@/lib/email/runner";
import {
  ActionFailure,
  actionOk,
  fail,
  toActionError,
  type ActionResult,
} from "@/lib/action-result";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
  if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");
  return user;
}

/** Editor HTML, sanitised on the way in — what is stored is what is sent. */
const bodyField = z
  .string()
  .max(EMAIL_BODY_MAX, "Nội dung quá dài.")
  .transform((html) => sanitizeEmailHtml(html));

const messageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("notice"),
    subject: z.string().trim().min(1, "Nhập tiêu đề email.").max(SUBJECT_MAX),
    body: bodyField.refine((html) => !isEmptyEmailHtml(html), "Nhập nội dung thông báo."),
  }),
  z.object({
    kind: z.literal("billing"),
    // Billing subjects carry each person's own amount, so none is typed.
    subject: z.string().optional().transform(() => ""),
    // The whole text, with placeholders for each person's figures. Emptied
    // out, it goes back to the standard wording rather than a bare button.
    body: bodyField.transform((html) => (isEmptyEmailHtml(html) ? DEFAULT_BILLING_TEMPLATE : html)),
  }),
]);

const recipientsSchema = z
  .object({
    audience: z.enum(["everyone", "selected"]),
    recipientUserIds: z.array(z.string().uuid()).max(500),
  })
  .refine((value) => value.audience === "everyone" || value.recipientUserIds.length > 0, {
    message: "Chọn ít nhất một người nhận.",
  });

const whenSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("now") }),
  z.object({
    mode: z.literal("schedule"),
    // A `datetime-local` value, read as Vietnam time.
    at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Chọn ngày giờ gửi."),
    repeat: z.enum(["none", "daily", "weekly", "monthly"]),
  }),
]);

/** Which of the uploaded banners frame the email; both unless switched off. */
const bannersSchema = z
  .object({ header: z.boolean(), footer: z.boolean() })
  .default({ header: true, footer: true });

const createSchema = z.object({
  message: messageSchema,
  banners: bannersSchema,
  recipients: recipientsSchema,
  when: whenSchema,
});

function zodMessage(cause: z.ZodError, fallback: string): ActionResult<never> {
  return { ok: false, error: cause.issues[0]?.message ?? fallback };
}

/**
 * Creates an email job. "Gửi ngay" is a job that runs straight away, so the
 * admin sees how many went out; a scheduled one waits for the cron.
 */
export async function createEmailJob(
  input: unknown,
): Promise<ActionResult<{ summary: RunSummary | null }>> {
  try {
    const admin = await assertAdmin();
    const { message, banners, recipients, when } = createSchema.parse(input);

    const firstRunAt = when.mode === "now" ? new Date() : localInputToInstant(when.at);
    if (when.mode === "schedule" && firstRunAt.getTime() <= Date.now()) {
      fail("Thời gian hẹn đã qua — chọn một thời điểm trong tương lai.");
    }

    const [job] = await db
      .insert(emailJobs)
      .values({
        kind: message.kind,
        subject: message.subject,
        body: message.body,
        audience: recipients.audience,
        recipientUserIds: recipients.audience === "selected" ? recipients.recipientUserIds : [],
        repeat: when.mode === "now" ? "none" : when.repeat,
        showHeader: banners.header,
        showFooter: banners.footer,
        firstRunAt,
        nextRunAt: firstRunAt,
        createdByUserId: admin.id,
      })
      .returning({ id: emailJobs.id });

    const summary = when.mode === "now" ? await runJobNow(job.id) : null;

    revalidatePath("/admin/emails");
    return actionOk({ summary });
  } catch (cause) {
    if (cause instanceof z.ZodError) return zodMessage(cause, "Email chưa hợp lệ.");
    return toActionError(cause, "Không gửi được email.");
  }
}

/** Sends the email as composed to the admin alone. Nothing is recorded. */
export async function sendTestEmailToMe(input: unknown): Promise<ActionResult> {
  try {
    const admin = await assertAdmin();
    const { message, banners } = z
      .object({ message: messageSchema, banners: bannersSchema })
      .parse(input);
    await sendTestEmail(admin, { ...message, showHeader: banners.header, showFooter: banners.footer });
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) return zodMessage(cause, "Email chưa hợp lệ.");
    // A mail-server error ("Invalid login", a bad port) is exactly what the
    // admin needs to see to fix the setup, so it is shown rather than hidden.
    if (cause instanceof Error && !(cause instanceof ActionFailure)) {
      console.error("[email] test failed", cause);
      return { ok: false, error: `Không gửi được: ${cause.message}` };
    }
    return toActionError(cause, "Không gửi được email thử.");
  }
}

/**
 * The composer's live preview: the email as one recipient would get it —
 * a billing email with that person's real debt. Nothing is sent or stored.
 */
export async function previewEmailHtml(
  input: unknown,
): Promise<ActionResult<{ subject: string; html: string; name: string }>> {
  try {
    const admin = await assertAdmin();
    const { message, banners, sampleUserId } = z
      .object({
        // Unchecked: a preview should show a half-written email too.
        message: z.object({
          kind: z.enum(["notice", "billing"]),
          subject: z.string().max(SUBJECT_MAX).default(""),
          body: bodyField,
        }),
        banners: bannersSchema,
        sampleUserId: z.string().uuid().nullable().default(null),
      })
      .parse(input);

    const [sample] = sampleUserId
      ? await db
          .select({ id: users.id, email: users.email, displayName: users.displayName })
          .from(users)
          .where(eq(users.id, sampleUserId))
      : [];
    const preview = await previewEmail(
      {
        kind: message.kind,
        subject: message.subject,
        body: message.body,
        showHeader: banners.header,
        showFooter: banners.footer,
      },
      sample ?? admin,
    );
    return actionOk(preview);
  } catch (cause) {
    if (cause instanceof z.ZodError) return zodMessage(cause, "Email chưa hợp lệ.");
    return toActionError(cause, "Không xem trước được email.");
  }
}

/**
 * Stores a picture for an email body and returns where the editor can show
 * it. The browser has already scaled it down; the bytes decide its type.
 */
export async function uploadEmailImage(
  formData: FormData,
): Promise<ActionResult<{ src: string }>> {
  try {
    const admin = await assertAdmin();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) fail("Hãy chọn một ảnh.");
    if (file.size > EMAIL_IMAGE_MAX_BYTES) fail("Ảnh quá lớn — tối đa 2 MB.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) fail("Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.");

    const [image] = await db
      .insert(emailImages)
      .values({
        data: Buffer.from(bytes).toString("base64"),
        type,
        createdByUserId: admin.id,
      })
      .returning({ id: emailImages.id });

    return actionOk({ src: `${EMAIL_IMAGE_PATH}${image.id}` });
  } catch (cause) {
    return toActionError(cause, "Không tải được ảnh lên.");
  }
}

/** Stops a scheduled or repeating email. Its history stays. */
export async function cancelEmailJob(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { jobId } = z.object({ jobId: z.string().uuid() }).parse(input);

    const [cancelled] = await db
      .update(emailJobs)
      .set({ status: "cancelled", nextRunAt: null })
      .where(and(eq(emailJobs.id, jobId), eq(emailJobs.status, "scheduled")))
      .returning({ id: emailJobs.id });
    if (!cancelled) fail("Email này đã gửi xong hoặc đã huỷ.");

    revalidatePath("/admin/emails");
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không huỷ được email.");
  }
}
