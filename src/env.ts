import "server-only";

/**
 * Server-side environment access. Throws loudly at first use rather than
 * silently producing `undefined` deep inside a request.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.local.example to .env.local and fill it in.`,
    );
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const serverEnv = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get adminEmails(): string[] {
    return optional("ADMIN_EMAILS")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  },
  get appUrl() {
    return optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  },
  get defaultBank() {
    return {
      bankCode: optional("DEFAULT_BANK_CODE"),
      bankAccountNo: optional("DEFAULT_BANK_ACCOUNT_NO"),
      bankAccountName: optional("DEFAULT_BANK_ACCOUNT_NAME"),
    };
  },
  /**
   * Outgoing mail. Null until host, user and password are all set: in
   * development emails are then printed to the console instead, in production
   * sending refuses, and /admin/emails says SMTP is not configured.
   */
  get smtp() {
    const host = optional("SMTP_HOST");
    const user = optional("SMTP_USER");
    const pass = optional("SMTP_PASS");
    if (!host || !user || !pass) return null;
    return { host, port: Number(optional("SMTP_PORT", "465")), user, pass };
  },
  /** The From header, e.g. `Cơm trưa <you@gmail.com>`. */
  get emailFrom() {
    return optional("EMAIL_FROM") || optional("SMTP_USER");
  },
  get emailReplyTo() {
    return optional("EMAIL_REPLY_TO");
  },
  /**
   * When set, every email goes to this one address instead of its real
   * recipient — so a dev database full of colleagues' emails is safe to test on.
   */
  get emailRedirectTo() {
    return optional("EMAIL_REDIRECT_TO");
  },
  /** What cron-job.org sends as `Authorization: Bearer …`. */
  get cronSecret() {
    return required("CRON_SECRET");
  },
} as const;
