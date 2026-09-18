/**
 * VietQR quicklink API — returns a ready-made QR image URL that every Vietnamese
 * banking app can scan, with the amount and transfer memo pre-filled. No QR
 * generation library needed.
 *
 * Docs: https://www.vietqr.io/danh-sach-api/link-tao-ma-qr/
 */
const VIETQR_BASE = "https://img.vietqr.io/image";

export type BankAccount = {
  bankCode: string; // e.g. "VCB", "TCB", "MB" — see https://api.vietqr.io/v2/banks
  bankAccountNo: string;
  bankAccountName: string;
  qrTemplate?: string; // compact | compact2 | qr_only | print
};

export function isBankAccountConfigured(account: Partial<BankAccount> | null): boolean {
  return Boolean(account?.bankCode && account?.bankAccountNo);
}

export function buildVietQrUrl(
  account: BankAccount,
  options: { amountVnd?: number; memo?: string } = {},
): string {
  const template = account.qrTemplate || "compact2";
  const url = new URL(
    `${VIETQR_BASE}/${account.bankCode}-${account.bankAccountNo}-${template}.png`,
  );
  if (options.amountVnd && options.amountVnd > 0) {
    url.searchParams.set("amount", String(Math.round(options.amountVnd)));
  }
  if (options.memo) url.searchParams.set("addInfo", options.memo);
  if (account.bankAccountName) {
    url.searchParams.set("accountName", account.bankAccountName);
  }
  return url.toString();
}

/**
 * A short, stable, human-readable memo so a bank notification can be matched back
 * to a person. Vietnamese banks strip diacritics and most punctuation from the
 * transfer description, so we only ever emit `[A-Z0-9 ]`.
 */
export function buildTransferMemo(input: {
  email: string;
  displayName?: string | null;
  claimId?: string;
}): string {
  const handle = (input.displayName || input.email.split("@")[0] || "USER")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0110/g, "D")
    .replace(/\u0111/g, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 12);
  const ref = input.claimId ? input.claimId.replace(/-/g, "").slice(0, 6).toUpperCase() : "";
  return ["LUNCH", handle, ref].filter(Boolean).join(" ");
}
