/**
 * Giảm giá sinh nhật — the rules, with no database in sight so both the server
 * and the forms on screen can import them.
 *
 * A birthday is a day and a month; the year is never asked for. On that date
 * (Vietnam time, like every `ServiceDate`) the person's whole bill for the day
 * — food, suất and ship — is 10% cheaper. It adds to a lì xì opened the same
 * day rather than replacing it. Someone born on 29 February celebrates on the
 * 28th in a year without one, so nobody goes three years without a discount.
 */

import { z } from "zod";

import type { ServiceDate } from "./date";

export const BIRTHDAY_PERCENT = 10;

export type Birthday = { month: number; day: number };

/** Days in each month, February counted with its leap day — a birthday may be the 29th. */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(month: number): number {
  return DAYS_IN_MONTH[month - 1] ?? 31;
}

/** The two nullable columns as a birthday, or null when none is set. */
export function toBirthday(month: number | null, day: number | null): Birthday | null {
  return month === null || day === null ? null : { month, day };
}

/** The only definition of a valid birthday: the profile and the admin both parse it. */
export const birthdayField = z
  .object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  })
  .refine((birthday) => birthday.day <= daysInMonth(birthday.month), {
    message: "Ngày sinh không có thật.",
  });

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The date it is celebrated in `year`: itself, or 28 February for a leap-day birthday in a common year. */
export function birthdayInYear(birthday: Birthday, year: number): ServiceDate {
  const day = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day;
  return `${year}-${pad(birthday.month)}-${pad(day)}`;
}

export function isBirthdayOn(birthday: Birthday | null, date: ServiceDate): boolean {
  return birthday !== null && birthdayInYear(birthday, Number(date.slice(0, 4))) === date;
}

/** Every date in `from`…`to` (inclusive) that is this birthday — one per year spanned. */
export function birthdaysBetween(birthday: Birthday, from: ServiceDate, to: ServiceDate): ServiceDate[] {
  const dates: ServiceDate[] = [];
  for (let year = Number(from.slice(0, 4)); year <= Number(to.slice(0, 4)); year++) {
    const date = birthdayInYear(birthday, year);
    if (date >= from && date <= to) dates.push(date);
  }
  return dates;
}

/** "12/03" — day first, as Vietnamese dates are written. */
export function formatBirthday(birthday: Birthday): string {
  return `${pad(birthday.day)}/${pad(birthday.month)}`;
}
