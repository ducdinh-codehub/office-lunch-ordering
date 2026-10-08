/** Limits on a bill the admin writes by hand — shared by the form and the action. */

/** One bill is a receipt, not a ledger. */
export const MANUAL_BILL_MAX_ITEMS = 30;

export const MANUAL_BILL_TITLE_MAX = 80;
export const MANUAL_BILL_ITEM_NAME_MAX = 80;

/** The most one portion may cost. */
export const MANUAL_BILL_MAX_UNIT_PRICE_VND = 5_000_000;

/**
 * The most one bill may come to. Money is integer VND and summed into 32-bit
 * columns downstream (`payments.amount_vnd`), so a bill is kept far below that
 * — the same reason bookings cap their quantity at 99.
 */
export const MANUAL_BILL_MAX_TOTAL_VND = 20_000_000;

/** "HH:MM" from Postgres' `time` ("HH:MM:SS"), or null. */
export function formatServiceTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}
