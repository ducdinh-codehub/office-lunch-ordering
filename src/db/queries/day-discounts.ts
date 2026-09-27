import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { birthdaysBetween, isBirthdayOn, toBirthday } from "@/lib/birthday";
import type { ServiceDate } from "@/lib/date";
import type { DayDiscount } from "@/lib/day-discount";
import { envelopeKey, getEnvelopePercents } from "./lucky-envelopes";

/** Key for the map below: one person, on one date. */
export const discountKey = envelopeKey;

/**
 * Everything that comes off anyone's bill in a date range or on a set of dates
 * — lì xì and birthdays — as `discountKey` → `DayDiscount`. Optionally for one
 * person only. A person and date with neither is simply absent.
 *
 * Every total reads its discounts from here and nowhere else, which is what
 * keeps the bookings page, a claim, the roster and the bill export agreeing.
 */
export async function getDayDiscounts(
  where: ({ from: ServiceDate; to: ServiceDate } | { dates: ServiceDate[] }) & {
    userId?: string;
  },
): Promise<Map<string, DayDiscount>> {
  if ("dates" in where && where.dates.length === 0) return new Map();

  const hasBirthday = isNotNull(users.birthMonth);
  const [envelopes, people] = await Promise.all([
    getEnvelopePercents(where),
    db
      .select({ id: users.id, birthMonth: users.birthMonth, birthDay: users.birthDay })
      .from(users)
      .where(where.userId ? and(hasBirthday, eq(users.id, where.userId)) : hasBirthday),
  ]);

  const discounts = new Map<string, DayDiscount>();
  for (const [key, percent] of envelopes) {
    discounts.set(key, { luckyPercent: percent, birthday: false });
  }
  for (const person of people) {
    const birthday = toBirthday(person.birthMonth, person.birthDay);
    if (!birthday) continue;
    const dates =
      "dates" in where
        ? where.dates.filter((date) => isBirthdayOn(birthday, date))
        : birthdaysBetween(birthday, where.from, where.to);
    for (const date of dates) {
      const key = discountKey(person.id, date);
      const existing = discounts.get(key);
      if (existing) existing.birthday = true;
      else discounts.set(key, { luckyPercent: null, birthday: true });
    }
  }
  return discounts;
}
