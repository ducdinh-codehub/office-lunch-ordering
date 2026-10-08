import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { manualBillItems, manualBills, users } from "@/db/schema";
import type { ServiceDate } from "@/lib/date";

export type ManualBillTotal = {
  userId: string;
  serviceDate: ServiceDate;
  totalVnd: number;
  billCount: number;
  displayName: string | null;
  email: string;
  photoUrl: string | null;
};

/**
 * What the admin's hand-written bills add to each person's day, in a date
 * range or on a set of dates — one row per person per date. Optionally for one
 * person only.
 *
 * Every total adds these before the discounts, the same way it adds a suất or
 * a ship share: the bookings page, a claim, the roster and the billing email
 * all read money through `getUserDailyTotals` / `getUserTotalsForDates` /
 * `getPaymentRoster`, and those read hand-written bills from here.
 */
export async function getManualBillTotals(
  where: ({ from: ServiceDate; to: ServiceDate } | { dates: ServiceDate[] }) & {
    userId?: string;
  },
): Promise<ManualBillTotal[]> {
  if ("dates" in where && where.dates.length === 0) return [];

  const onDates =
    "dates" in where
      ? inArray(manualBills.serviceDate, where.dates)
      : and(gte(manualBills.serviceDate, where.from), lte(manualBills.serviceDate, where.to));

  const rows = await db
    .select({
      userId: manualBills.userId,
      serviceDate: manualBills.serviceDate,
      // Summed wide, then narrowed in JS: each bill is capped far below 2^31.
      totalVnd: sql<string>`coalesce(sum(${manualBillItems.quantity}::bigint * ${manualBillItems.unitPriceVnd}), 0)`,
      billCount: sql<number>`count(distinct ${manualBills.id})::int`,
      displayName: users.displayName,
      email: users.email,
      photoUrl: users.photoUrl,
    })
    .from(manualBills)
    .innerJoin(users, eq(users.id, manualBills.userId))
    .leftJoin(manualBillItems, eq(manualBillItems.billId, manualBills.id))
    .where(where.userId ? and(onDates, eq(manualBills.userId, where.userId)) : onDates)
    .groupBy(
      manualBills.userId,
      manualBills.serviceDate,
      users.displayName,
      users.email,
      users.photoUrl,
    );

  return rows.map((row) => ({
    ...row,
    totalVnd: Number(row.totalVnd),
    billCount: Number(row.billCount),
  }));
}

export type ManualBillLine = {
  name: string;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
};

export type ManualBillDetail = {
  id: string;
  userId: string;
  displayName: string | null;
  email: string;
  serviceDate: ServiceDate;
  /** "HH:MM:SS", Vietnam wall-clock, or null when no time was given. */
  serviceTime: string | null;
  title: string | null;
  items: ManualBillLine[];
  totalVnd: number;
  createdAt: Date;
};

/**
 * Hand-written bills with their lines, newest date first. For the diner's own
 * list (`userId`) or the admin's (everyone).
 */
export async function listManualBills(where: {
  from: ServiceDate;
  to: ServiceDate;
  userId?: string;
}): Promise<ManualBillDetail[]> {
  const inRange = and(
    gte(manualBills.serviceDate, where.from),
    lte(manualBills.serviceDate, where.to),
  );

  const bills = await db
    .select({
      id: manualBills.id,
      userId: manualBills.userId,
      displayName: users.displayName,
      email: users.email,
      serviceDate: manualBills.serviceDate,
      serviceTime: manualBills.serviceTime,
      title: manualBills.title,
      createdAt: manualBills.createdAt,
    })
    .from(manualBills)
    .innerJoin(users, eq(users.id, manualBills.userId))
    .where(where.userId ? and(inRange, eq(manualBills.userId, where.userId)) : inRange)
    .orderBy(
      desc(manualBills.serviceDate),
      sql`${manualBills.serviceTime} desc nulls last`,
      desc(manualBills.createdAt),
    );
  if (bills.length === 0) return [];

  const lines = await db
    .select({
      billId: manualBillItems.billId,
      name: manualBillItems.name,
      quantity: manualBillItems.quantity,
      unitPriceVnd: manualBillItems.unitPriceVnd,
    })
    .from(manualBillItems)
    .where(
      inArray(
        manualBillItems.billId,
        bills.map((bill) => bill.id),
      ),
    )
    .orderBy(asc(manualBillItems.sortOrder));

  const byBill = new Map<string, ManualBillLine[]>();
  for (const line of lines) {
    const existing = byBill.get(line.billId) ?? [];
    existing.push({
      name: line.name,
      quantity: line.quantity,
      unitPriceVnd: line.unitPriceVnd,
      lineTotalVnd: line.quantity * line.unitPriceVnd,
    });
    byBill.set(line.billId, existing);
  }

  return bills.map((bill) => {
    const items = byBill.get(bill.id) ?? [];
    return {
      ...bill,
      items,
      totalVnd: items.reduce((total, line) => total + line.lineTotalVnd, 0),
    };
  });
}
