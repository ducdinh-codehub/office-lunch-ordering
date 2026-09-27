import "server-only";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { luckyEnvelopes, type LuckyEnvelope } from "@/db/schema";
import type { ServiceDate } from "@/lib/date";

/** Key for the discount maps below: one envelope per person, on one date. */
export function envelopeKey(userId: string, serviceDate: ServiceDate): string {
  return `${userId}:${serviceDate}`;
}

/**
 * The envelope discounts that fall in a date range or on a set of dates, as
 * `envelopeKey` → percent. Optionally for one person only.
 *
 * Deliberately not gated on the feature switch: turning it off deletes the
 * rows, so what is left is exactly what should still count.
 */
export async function getEnvelopePercents(
  where: ({ from: ServiceDate; to: ServiceDate } | { dates: ServiceDate[] }) & {
    userId?: string;
  },
): Promise<Map<string, number>> {
  if ("dates" in where && where.dates.length === 0) return new Map();

  const onDates =
    "dates" in where
      ? inArray(luckyEnvelopes.serviceDate, where.dates)
      : and(gte(luckyEnvelopes.serviceDate, where.from), lte(luckyEnvelopes.serviceDate, where.to));

  const rows = await db
    .select({
      userId: luckyEnvelopes.userId,
      serviceDate: luckyEnvelopes.serviceDate,
      percent: luckyEnvelopes.percent,
    })
    .from(luckyEnvelopes)
    .where(where.userId ? and(onDates, eq(luckyEnvelopes.userId, where.userId)) : onDates);

  return new Map(rows.map((row) => [envelopeKey(row.userId, row.serviceDate), row.percent]));
}

/** This person's envelope, if they have opened one this round. */
export async function getUserEnvelope(userId: string): Promise<LuckyEnvelope | null> {
  const [row] = await db
    .select()
    .from(luckyEnvelopes)
    .where(eq(luckyEnvelopes.userId, userId))
    .limit(1);
  return row ?? null;
}

/** How this round has gone, for the admin card: opened, and how many of each prize. */
export async function getEnvelopeStats(): Promise<{
  opened: number;
  byPercent: Record<number, number>;
}> {
  const rows = await db
    .select({ percent: luckyEnvelopes.percent, count: sql<number>`count(*)::int` })
    .from(luckyEnvelopes)
    .groupBy(luckyEnvelopes.percent);

  const byPercent: Record<number, number> = {};
  for (const row of rows) byPercent[row.percent] = Number(row.count);
  return { opened: rows.reduce((total, row) => total + Number(row.count), 0), byPercent };
}
