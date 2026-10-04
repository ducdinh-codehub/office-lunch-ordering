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

/** A secret without the spaces, line breaks or quotes it was pasted with. */
export function cleanSecret(value: string): string {
  return value.trim().replace(/^(["'])([\s\S]*)\1$/, "$2").trim();
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
  /**
   * Where links in emails point — the Thanh toán button above all. On Vercel
   * a missing or localhost value (easily copied from a local env file) would
   * send every recipient to the sender's own laptop, so it falls back to the
   * project's production domain, which Vercel provides itself.
   */
  get appUrl() {
    const configured = optional("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
    const onVercel = Boolean(process.env.VERCEL);
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(configured);
    if (configured && !(onVercel && isLocal)) return configured;
    const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (onVercel && production) return `https://${production}`;
    return configured || "http://localhost:3000";
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
  /**
   * What cron-job.org sends as `Authorization: Bearer …`. Surrounding spaces
   * and quotes are dropped: pasted into a dashboard, they are kept as part of
   * the value and every call is then refused for an invisible reason.
   */
  get cronSecret() {
    return cleanSecret(required("CRON_SECRET"));
  },
  /**
   * The owner's own Gym Time site, which this deployment may promote. Private
   * to that deployment and deliberately absent from .env.local.example: unset
   * — as in any clone of the repo — Gym Time does not exist at all, no banner,
   * no dialog, no settings card, and the switch is refused server-side.
   */
  get gymTimeUrl(): string | null {
    const url = optional("GYM_TIME_URL").trim();
    return /^https:\/\//.test(url) ? url : null;
  },
} as const;
