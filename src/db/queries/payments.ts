import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/db";
import { bookings, dayOrders, menuDays, menuItems, payments, users, PAID_CATEGORIES } from "@/db/schema";
import { getShipShares, getUserDailyTotals } from "./bookings";
import type { ServiceDate } from "@/lib/date";

export type PaymentState = "unpaid" | "pending" | "confirmed" | "rejected";

export type DayLedgerEntry = {
  serviceDate: ServiceDate;
  owedVnd: number;
  state: PaymentState;
  paymentId: string | null;
  claimId: string | null;
  note: string | null;
};

/**
 * A user's ledger: every day they booked in the range, with what they owe and
 * where that day stands. `unpaid` is the absence of a payments row — a rejected
 * claim also lands back in the "you still owe this" bucket via `rejected`.
 */
export async function getUserLedger(
  userId: string,
  from: ServiceDate,
  to: ServiceDate,
): Promise<DayLedgerEntry[]> {
  // Deliberately the same function the bookings page and a payment claim use, so
  // a day can never be owed one amount here and a different one at checkout.
  const rows = await getUserDailyTotals(userId, from, to);

  const paymentRows = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        gte(payments.serviceDate, from),
        lte(payments.serviceDate, to),
      ),
    );

  const byDate = new Map(paymentRows.map((row) => [row.serviceDate, row]));

  return rows.map((row) => {
    const payment = byDate.get(row.serviceDate);
    return {
      serviceDate: row.serviceDate,
      owedVnd: row.totalVnd,
      state: (payment?.status ?? "unpaid") as PaymentState,
      paymentId: payment?.id ?? null,
      claimId: payment?.claimId ?? null,
      note: payment?.note ?? null,
    };
  });
}

/** Dates the user can still claim: booked, and not pending or confirmed. */
export function settleableEntries(ledger: DayLedgerEntry[]): DayLedgerEntry[] {
  return ledger.filter(
    (entry) => entry.owedVnd > 0 && (entry.state === "unpaid" || entry.state === "rejected"),
  );
}

export type RosterCell = { owedVnd: number; state: PaymentState };

export type RosterRow = {
  userId: string;
  displayName: string | null;
  email: string;
  photoUrl: string | null;
  cells: Map<ServiceDate, RosterCell>;
  totalOwedVnd: number;
  outstandingVnd: number;
  pendingVnd: number;
  confirmedVnd: number;
  fullySettled: boolean;
};

/**
 * The admin payment roster: every user who booked in the range, each day they
 * booked, and whether that day is settled. This is the "who has completely paid"
 * view.
 */
export async function getPaymentRoster(
  from: ServiceDate,
  to: ServiceDate,
): Promise<{ rows: RosterRow[]; dates: ServiceDate[] }> {
  const inRange = and(gte(menuDays.serviceDate, from), lte(menuDays.serviceDate, to));
  const person = {
    userId: users.id,
    displayName: users.displayName,
    email: users.email,
    photoUrl: users.photoUrl,
  };

  // Two halves of the same total: per-portion add-ons and drinks, plus the set
  // price of everyone whose set was completed that day.
  const [paidRows, setRows] = await Promise.all([
    db
      .select({
        ...person,
        serviceDate: menuDays.serviceDate,
        owedVnd: sql<number>`coalesce(sum(${bookings.quantity} * ${bookings.unitPriceVnd}), 0)::int`,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
      .innerJoin(menuDays, eq(menuDays.id, bookings.menuDayId))
      .where(
        and(
          eq(bookings.status, "booked"),
          inArray(menuItems.category, [...PAID_CATEGORIES]),
          inRange,
        ),
      )
      .groupBy(users.id, users.displayName, users.email, users.photoUrl, menuDays.serviceDate)
      .orderBy(asc(users.displayName), asc(users.email)),
    db
      .select({
        ...person,
        serviceDate: menuDays.serviceDate,
        owedVnd: dayOrders.setPriceVnd,
      })
      .from(dayOrders)
      .innerJoin(users, eq(users.id, dayOrders.userId))
      .innerJoin(menuDays, eq(menuDays.id, dayOrders.menuDayId))
      .where(inRange)
      .orderBy(asc(users.displayName), asc(users.email)),
  ]);

  // Merge into one row per user per day before the cells are built.
  const merged = new Map<string, (typeof paidRows)[number]>();
  for (const row of [...setRows, ...paidRows]) {
    const key = `${row.userId}:${row.serviceDate}`;
    const existing = merged.get(key);
    if (existing) existing.owedVnd = Number(existing.owedVnd) + Number(row.owedVnd);
    else merged.set(key, { ...row, owedVnd: Number(row.owedVnd) });
  }
  // The delivery fee each person owes for that day, on top of their food.
  for (const share of await getShipShares({ from, to })) {
    const existing = merged.get(`${share.userId}:${share.serviceDate}`);
    if (existing) existing.owedVnd = Number(existing.owedVnd) + share.shareVnd;
  }

  const bookingRows = [...merged.values()].sort(
    (a, b) =>
      (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email, "vi") ||
      a.serviceDate.localeCompare(b.serviceDate),
  );

  const paymentRows = await db
    .select()
    .from(payments)
    .where(and(gte(payments.serviceDate, from), lte(payments.serviceDate, to)));

  const paymentByKey = new Map(
    paymentRows.map((row) => [`${row.userId}:${row.serviceDate}`, row]),
  );

  const dates = [...new Set(bookingRows.map((row) => row.serviceDate))].sort();
  const rowsByUser = new Map<string, RosterRow>();

  for (const row of bookingRows) {
    let entry = rowsByUser.get(row.userId);
    if (!entry) {
      entry = {
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        photoUrl: row.photoUrl,
        cells: new Map(),
        totalOwedVnd: 0,
        outstandingVnd: 0,
        pendingVnd: 0,
        confirmedVnd: 0,
        fullySettled: true,
      };
      rowsByUser.set(row.userId, entry);
    }

    const owedVnd = Number(row.owedVnd ?? 0);
    const state = (paymentByKey.get(`${row.userId}:${row.serviceDate}`)?.status ??
      "unpaid") as PaymentState;

    entry.cells.set(row.serviceDate, { owedVnd, state });
    entry.totalOwedVnd += owedVnd;
    if (state === "confirmed") entry.confirmedVnd += owedVnd;
    else if (state === "pending") entry.pendingVnd += owedVnd;
    else entry.outstandingVnd += owedVnd;
    if (state !== "confirmed") entry.fullySettled = false;
  }

  return { rows: [...rowsByUser.values()], dates };
}

export type PendingClaim = {
  claimId: string;
  userId: string;
  displayName: string | null;
  email: string;
  photoUrl: string | null;
  serviceDates: ServiceDate[];
  totalVnd: number;
  claimedAt: Date;
  note: string | null;
};

/** Claims awaiting a decision, grouped by the bank transfer they belong to. */
export async function getPendingClaims(): Promise<PendingClaim[]> {
  const rows = await db
    .select({
      claimId: payments.claimId,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      photoUrl: users.photoUrl,
      serviceDate: payments.serviceDate,
      amountVnd: payments.amountVnd,
      claimedAt: payments.claimedAt,
      note: payments.note,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .where(eq(payments.status, "pending"))
    .orderBy(desc(payments.claimedAt), asc(payments.serviceDate));

  const claims = new Map<string, PendingClaim>();
  for (const row of rows) {
    let claim = claims.get(row.claimId);
    if (!claim) {
      claim = {
        claimId: row.claimId,
        userId: row.userId,
        displayName: row.displayName,
        email: row.email,
        photoUrl: row.photoUrl,
        serviceDates: [],
        totalVnd: 0,
        claimedAt: row.claimedAt,
        note: row.note,
      };
      claims.set(row.claimId, claim);
    }
    claim.serviceDates.push(row.serviceDate);
    claim.totalVnd += row.amountVnd;
  }
  return [...claims.values()];
}

/** Recomputes a claim's true amount from bookings — never trust a stored total alone. */
export async function getClaimDates(claimId: string): Promise<ServiceDate[]> {
  const rows = await db
    .select({ serviceDate: payments.serviceDate })
    .from(payments)
    .where(eq(payments.claimId, claimId));
  return rows.map((row) => row.serviceDate);
}

export async function getPaymentsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(payments).where(inArray(payments.id, ids));
}
