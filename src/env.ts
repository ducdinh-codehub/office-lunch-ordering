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
} as const;
