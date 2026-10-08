import "server-only";

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { adminDiscounts, users } from "@/db/schema";
import type { ServiceDate } from "@/lib/date";
import type { AdminDayDiscount } from "@/lib/day-discount";
import { envelopeKey } from "./lucky-envelopes";

/**
 * The discounts the admin set in a date range or on a set of dates, keyed like
 * every other discount map (`discountKey`). Optionally for one person only.
 * Totals read this through `getDayDiscounts`, never directly.
 */
export async function getAdminDiscounts(
  where: ({ from: ServiceDate; to: ServiceDate } | { dates: ServiceDate[] }) & {
    userId?: string;
  },
): Promise<Map<string, AdminDayDiscount>> {
  if ("dates" in where && where.dates.length === 0) return new Map();

  const onDates =
    "dates" in where
      ? inArray(adminDiscounts.serviceDate, where.dates)
      : and(gte(adminDiscounts.serviceDate, where.from), lte(adminDiscounts.serviceDate, where.to));

  const rows = await db
    .select({
      userId: adminDiscounts.userId,
      serviceDate: adminDiscounts.serviceDate,
      percent: adminDiscounts.percent,
      note: adminDiscounts.note,
    })
    .from(adminDiscounts)
    .where(where.userId ? and(onDates, eq(adminDiscounts.userId, where.userId)) : onDates);

  return new Map(
    rows.map((row) => [
      envelopeKey(row.userId, row.serviceDate),
      { percent: row.percent, note: row.note },
    ]),
  );
}

export type AdminDiscountRow = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  serviceDate: ServiceDate;
  percent: number;
  note: string | null;
};

/** Every admin discount from `from` on, for the admin's list — soonest first. */
export async function listAdminDiscounts(from: ServiceDate): Promise<AdminDiscountRow[]> {
  return db
    .select({
      id: adminDiscounts.id,
      userId: adminDiscounts.userId,
      displayName: users.displayName,
      email: users.email,
      serviceDate: adminDiscounts.serviceDate,
      percent: adminDiscounts.percent,
      note: adminDiscounts.note,
    })
    .from(adminDiscounts)
    .innerJoin(users, eq(users.id, adminDiscounts.userId))
    .where(gte(adminDiscounts.serviceDate, from))
    .orderBy(asc(adminDiscounts.serviceDate), asc(users.displayName), asc(users.email));
}
