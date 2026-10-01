import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { serverEnv } from "@/env";
import type { InlineAttachment } from "./content";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Pictures referenced from `html` as `cid:` — see `loadInlineImages`. */
  attachments?: InlineAttachment[];
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const smtp = serverEnv.smtp;
  if (!smtp) return null;
  transporter ??= nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    // 465 is TLS from the first byte; 587 upgrades with STARTTLS.
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
    // One connection, reused: Gmail throttles accounts that open many at once.
    pool: true,
    maxConnections: 1,
  });
  return transporter;
}

/** Whether a real mail server is configured — the admin page says so if not. */
export function isEmailConfigured(): boolean {
  return serverEnv.smtp !== null;
}

/**
 * Sends one email. Throws on failure — the caller records it per recipient.
 *
 * Without SMTP_HOST, development prints the email instead of sending it, and
 * production refuses: silently dropping a bill is worse than an error.
 * `EMAIL_REDIRECT_TO` reroutes everything to one address, for testing against
 * a database full of real colleagues.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const redirect = serverEnv.emailRedirectTo;
  const to = redirect || email.to;
  // The subject stays exactly as recipients would see it, so a test looks
  // like the real thing; who it was meant for travels in a header instead
  // (Gmail: ⋮ → Show original).
  const subject = email.subject;
  const headers = redirect ? { ...email.headers, "X-Intended-Recipient": email.to } : email.headers;

  const transport = getTransporter();
  if (!transport) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Chưa cấu hình máy chủ gửi email (SMTP_HOST).");
    }
    console.info(
      `[email] (not sent — SMTP not configured) to=${to} for=${email.to} subject=${subject} images=${email.attachments?.length ?? 0}\n${email.text}`,
    );
    return;
  }

  const replyTo = serverEnv.emailReplyTo;
  await transport.sendMail({
    from: serverEnv.emailFrom,
    to,
    subject,
    html: email.html,
    text: email.text,
    ...(replyTo ? { replyTo } : {}),
    headers,
    attachments: email.attachments?.map((image) => ({
      ...image,
      contentDisposition: "inline" as const,
    })),
  });
}
