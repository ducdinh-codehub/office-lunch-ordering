/**
 * What comes off a day's bill, and how much that is. Three things can: a lì xì
 * opened that day (5, 10 or 20%), the person's birthday (10%) and a discount
 * the admin set for them on that date. They add up — a 20% lì xì on your
 * birthday is 30% off — capped at 100%, and are taken off the *finished* day
 * total (food, suất, ship) in one go, rounded once.
 *
 * `discountVnd()` is the only place the amount is computed. Every total that
 * knows about discounts goes through it — the bookings and payments pages, a
 * payment claim, the admin roster and the bill export — so a day can never be
 * discounted by one amount in one place and another elsewhere.
 */

import { BIRTHDAY_PERCENT } from "./birthday";

export type DayDiscount = {
  /** The lì xì opened on this day, if any. */
  luckyPercent: number | null;
  /** True on the person's birthday. */
  birthday: boolean;
  /** What the admin gave them on this date, if anything. */
  adminDiscount: AdminDayDiscount | null;
};

export type AdminDayDiscount = {
  percent: number;
  /** Shown to the diner beside the discount. */
  note: string | null;
};

/** The most an admin discount may be, and the most all of them together come to. */
export const MAX_DISCOUNT_PERCENT = 100;

export function discountPercent(discount: DayDiscount | undefined): number {
  if (!discount) return 0;
  const sum =
    (discount.luckyPercent ?? 0) +
    (discount.birthday ? BIRTHDAY_PERCENT : 0) +
    (discount.adminDiscount?.percent ?? 0);
  // A day can be free, never negative.
  return Math.min(sum, MAX_DISCOUNT_PERCENT);
}

/**
 * How much comes off a day's total. Rounded down to the đồng, so the discount
 * never exceeds its percentage and money stays integer VND.
 */
export function discountVnd(totalVnd: number, percent: number): number {
  if (totalVnd <= 0 || percent <= 0) return 0;
  return Math.floor((totalVnd * percent) / 100);
}
