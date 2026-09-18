/**
 * VND has no minor unit, so every amount in this app is a plain integer number
 * of dong. Never introduce floats here.
 */
const formatter = new Intl.NumberFormat("vi-VN");

/** 45000 → "45.000 ₫" */
export function formatVnd(amount: number): string {
  return `${formatter.format(Math.round(amount))} ₫`;
}

/** 45000 → "45.000" (no symbol, for inputs and CSV) */
export function formatVndPlain(amount: number): string {
  return formatter.format(Math.round(amount));
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Divides an integer amount into `parts` whole shares that sum back to exactly
 * the amount — the first `amount % parts` shares carry one đồng more.
 *
 * Rounding each share up instead would over-collect, and the admin's "đã tính"
 * would stop reconciling with what the quán actually charged.
 */
export function splitEvenly(amount: number, parts: number): number[] {
  if (parts <= 0 || amount <= 0) return [];
  const base = Math.floor(amount / parts);
  const remainder = amount % parts;
  return Array.from({ length: parts }, (_, index) => base + (index < remainder ? 1 : 0));
}
