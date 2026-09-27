import "server-only";

import { and, asc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  bookings,
  dayOrders,
  menuDays,
  menuItems,
  users,
  PAID_CATEGORIES,
  SET_CATEGORIES,
  type MenuItemCategory,
  type SetTierKey,
} from "@/db/schema";
import { resolveSetTier } from "@/lib/set-tiers";
import { luckyDiscountVnd } from "@/lib/lucky-envelope";
import { envelopeKey, getEnvelopePercents } from "./lucky-envelopes";
import { splitEvenly } from "@/lib/money";
import type { ServiceDate } from "@/lib/date";

/**
 * What a day costs a person = the snapshotted set price, charged only once their
 * set was completed (which is exactly what a `day_orders` row means), plus every
 * per-portion add-on and drink.
 *
 * Set dishes never contribute an amount — their `unit_price_vnd` is 0 — so the
 * per-item half is restricted to the paid categories rather than trusting that.
 * Every total in the app is assembled from these same two halves, so the ledger,
 * the roster and a payment claim can never disagree.
 */
const paidItemsFilter = inArray(menuItems.category, [...PAID_CATEGORIES]);

export type BookingLine = {
  bookingId: string;
  menuItemId: string;
  itemName: string;
  category: MenuItemCategory;
  quantity: number;
  unitPriceVnd: number;
  lineTotalVnd: number;
  note: string | null;
};

/**
 * One user's active bookings for a single menu, set dishes included.
 *
 * Keyed on the menu, not the date: a date can hold a lunch and an afternoon
 * party, and folding the two together would show the party's dishes inside the
 * lunch card and count them towards its suất.
 */
export async function getUserBookingsForDay(
  userId: string,
  menuDayId: string,
): Promise<BookingLine[]> {
  const rows = await db
    .select({
      bookingId: bookings.id,
      menuItemId: bookings.menuItemId,
      itemName: menuItems.name,
      category: menuItems.category,
      quantity: bookings.quantity,
      unitPriceVnd: bookings.unitPriceVnd,
      note: bookings.note,
    })
    .from(bookings)
    .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.status, "booked"),
        eq(bookings.menuDayId, menuDayId),
      ),
    )
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));

  return rows.map((row) => ({
    ...row,
    lineTotalVnd: row.quantity * row.unitPriceVnd,
  }));
}

/** The suất price this user locked in for a menu, or null if they have no set. */
export async function getUserSetPriceForDay(
  userId: string,
  menuDayId: string,
): Promise<number | null> {
  const row = await db
    .select({ setPriceVnd: dayOrders.setPriceVnd })
    .from(dayOrders)
    .where(and(eq(dayOrders.userId, userId), eq(dayOrders.menuDayId, menuDayId)))
    .then((rows) => rows[0]);

  return row?.setPriceVnd ?? null;
}

export type DailyTotal = {
  serviceDate: ServiceDate;
  totalVnd: number;
  itemCount: number;
  /**
   * How many suất this person is charged for on this date. Normally 0 or 1, but
   * a date selling an afternoon party alongside lunch can bill two.
   */
  setCount: number;
  /**
   * True when they started a suất somewhere that day and did not finish it —
   * picked at least one món chính / phụ / rau on a menu with no completed set.
   *
   * Not the same as "no suất": a per-dish menu, an afternoon party included,
   * has no suất to be incomplete, and neither does a date where the only
   * bookings are drinks and gọi thêm. Saying otherwise sends people looking for
   * a dish they were never asked to pick.
   */
  incompleteSet: boolean;
  /** This person's slice of the day's delivery fee, across every menu that day. */
  shipVnd: number;
  /**
   * What their lì xì took off, already subtracted from `totalVnd` — 0 on every
   * day but the one they opened it. `luckyPercent` is null on those days.
   */
  luckyDiscountVnd: number;
  luckyPercent: number | null;
};

/**
 * What each day cost a user, across a date range. This is the single source of
 * truth for "amount owed" — payment amounts are always recomputed from here,
 * never taken from the client.
 *
 * One row per *date*, not per menu: a lunch and an afternoon party on the same
 * day are summed into a single amount, because they are settled by a single
 * bank transfer. `payments` is keyed the same way, and that is what keeps the
 * two in step.
 *
 * A day with dishes picked but an unfinished set still appears, at 0 ₫: nothing
 * is owed until the set is complete, but the diner should still see their day.
 */
export async function getUserDailyTotals(
  userId: string,
  from: ServiceDate,
  to: ServiceDate,
): Promise<DailyTotal[]> {
  const inRange = and(gte(menuDays.serviceDate, from), lte(menuDays.serviceDate, to));

  const [itemRows, setRows, setPickRows, shipShares, envelopes] = await Promise.all([
    db
      .select({
        serviceDate: menuDays.serviceDate,
        paidVnd: sql<number>`coalesce(sum(case when ${paidItemsFilter} then ${bookings.quantity} * ${bookings.unitPriceVnd} else 0 end), 0)::int`,
        itemCount: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int`,
      })
      .from(bookings)
      .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
      .innerJoin(menuDays, eq(menuDays.id, bookings.menuDayId))
      .where(and(eq(bookings.userId, userId), eq(bookings.status, "booked"), inRange))
      .groupBy(menuDays.serviceDate),
    db
      .select({
        serviceDate: menuDays.serviceDate,
        menuDayId: dayOrders.menuDayId,
        setPriceVnd: dayOrders.setPriceVnd,
      })
      .from(dayOrders)
      .innerJoin(menuDays, eq(menuDays.id, dayOrders.menuDayId))
      .where(and(eq(dayOrders.userId, userId), inRange)),
    // Menus where they took a set dish. Compared against the completed sets
    // above, this is what separates "your suất is short a món" from "this menu
    // never had a suất".
    db
      .selectDistinct({
        serviceDate: menuDays.serviceDate,
        menuDayId: bookings.menuDayId,
      })
      .from(bookings)
      .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
      .innerJoin(menuDays, eq(menuDays.id, bookings.menuDayId))
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.status, "booked"),
          inArray(menuItems.category, [...SET_CATEGORIES]),
          inRange,
        ),
      ),
    getShipShares({ from, to }),
    getEnvelopePercents({ from, to, userId }),
  ]);

  const byDate = new Map<ServiceDate, DailyTotal>();
  for (const row of itemRows) {
    byDate.set(row.serviceDate, {
      serviceDate: row.serviceDate,
      totalVnd: Number(row.paidVnd ?? 0),
      itemCount: Number(row.itemCount ?? 0),
      setCount: 0,
      incompleteSet: false,
      shipVnd: 0,
      luckyDiscountVnd: 0,
      luckyPercent: null,
    });
  }
  for (const row of setRows) {
    const existing = byDate.get(row.serviceDate);
    if (existing) {
      existing.totalVnd += row.setPriceVnd;
      existing.setCount += 1;
    } else {
      // A set with no booking rows can't happen, but never drop money if it does.
      byDate.set(row.serviceDate, {
        serviceDate: row.serviceDate,
        totalVnd: row.setPriceVnd,
        itemCount: 0,
        setCount: 1,
        incompleteSet: false,
        shipVnd: 0,
        luckyDiscountVnd: 0,
        luckyPercent: null,
      });
    }
  }

  const completedMenus = new Set(setRows.map((row) => row.menuDayId));
  for (const row of setPickRows) {
    if (completedMenus.has(row.menuDayId)) continue;
    const existing = byDate.get(row.serviceDate);
    if (existing) existing.incompleteSet = true;
  }

  for (const share of shipShares) {
    if (share.userId !== userId) continue;
    const existing = byDate.get(share.serviceDate);
    if (existing) {
      existing.totalVnd += share.shareVnd;
      // Two menus on one date each carry their own delivery, so this adds up
      // rather than overwrites — otherwise the displayed fee would disagree
      // with the total it is part of.
      existing.shipVnd += share.shareVnd;
    }
  }

  // Last, once the day's total is complete: the lì xì comes off all of it.
  for (const day of byDate.values()) {
    const percent = envelopes.get(envelopeKey(userId, day.serviceDate));
    if (percent === undefined) continue;
    day.luckyPercent = percent;
    day.luckyDiscountVnd = luckyDiscountVnd(day.totalVnd, percent);
    day.totalVnd -= day.luckyDiscountVnd;
  }

  return [...byDate.values()].sort((a, b) => (a.serviceDate < b.serviceDate ? 1 : -1));
}

/** Totals for a set of specific dates — used when validating a payment claim. */
export async function getUserTotalsForDates(
  userId: string,
  serviceDates: ServiceDate[],
): Promise<Map<ServiceDate, number>> {
  if (serviceDates.length === 0) return new Map();

  const onDates = inArray(menuDays.serviceDate, serviceDates);

  const [itemRows, setRows, shipShares, envelopes] = await Promise.all([
    db
      .select({
        serviceDate: menuDays.serviceDate,
        paidVnd: sql<number>`coalesce(sum(${bookings.quantity} * ${bookings.unitPriceVnd}), 0)::int`,
      })
      .from(bookings)
      .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
      .innerJoin(menuDays, eq(menuDays.id, bookings.menuDayId))
      .where(
        and(
          eq(bookings.userId, userId),
          eq(bookings.status, "booked"),
          paidItemsFilter,
          onDates,
        ),
      )
      .groupBy(menuDays.serviceDate),
    db
      .select({ serviceDate: menuDays.serviceDate, setPriceVnd: dayOrders.setPriceVnd })
      .from(dayOrders)
      .innerJoin(menuDays, eq(menuDays.id, dayOrders.menuDayId))
      .where(and(eq(dayOrders.userId, userId), onDates)),
    getShipShares({ dates: serviceDates }),
    getEnvelopePercents({ dates: serviceDates, userId }),
  ]);

  const totals = new Map<ServiceDate, number>();
  for (const row of itemRows) {
    totals.set(row.serviceDate, Number(row.paidVnd ?? 0));
  }
  for (const row of setRows) {
    totals.set(row.serviceDate, (totals.get(row.serviceDate) ?? 0) + row.setPriceVnd);
  }
  for (const share of shipShares) {
    if (share.userId !== userId) continue;
    // Only days the person actually ate on carry a share.
    if (!totals.has(share.serviceDate)) continue;
    totals.set(share.serviceDate, totals.get(share.serviceDate)! + share.shareVnd);
  }
  // The lì xì, on the finished total — the same rule getUserDailyTotals applies.
  for (const [serviceDate, total] of totals) {
    const percent = envelopes.get(envelopeKey(userId, serviceDate));
    if (percent !== undefined) totals.set(serviceDate, total - luckyDiscountVnd(total, percent));
  }
  return totals;
}

/**
 * Who the delivery is actually for on a given day: anyone with a completed set,
 * plus anyone who ordered à-la-carte without one. Those are the people whose
 * food is in the bag, so those are the people who share the ship fee.
 *
 * Sorted by id purely so the one-đồng remainder lands deterministically.
 */
async function getDinerIds(menuDayIds: string[]): Promise<Map<string, string[]>> {
  if (menuDayIds.length === 0) return new Map();

  const [setRows, paidRows] = await Promise.all([
    db
      .select({ menuDayId: dayOrders.menuDayId, userId: dayOrders.userId })
      .from(dayOrders)
      .where(inArray(dayOrders.menuDayId, menuDayIds)),
    db
      .selectDistinct({ menuDayId: bookings.menuDayId, userId: bookings.userId })
      .from(bookings)
      .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
      .where(
        and(
          inArray(bookings.menuDayId, menuDayIds),
          eq(bookings.status, "booked"),
          paidItemsFilter,
        ),
      ),
  ]);

  const byDay = new Map<string, Set<string>>();
  for (const row of [...setRows, ...paidRows]) {
    const existing = byDay.get(row.menuDayId) ?? new Set<string>();
    existing.add(row.userId);
    byDay.set(row.menuDayId, existing);
  }

  return new Map([...byDay].map(([dayId, ids]) => [dayId, [...ids].sort()]));
}

export type ShipShare = {
  userId: string;
  serviceDate: ServiceDate;
  /** Which menu the fee is for — a date with two sittings produces two shares. */
  menuDayId: string;
  shareVnd: number;
};

/**
 * Each diner's slice of the ship fee, for a set of days.
 *
 * While a day is open the split is recomputed from the current diners, so the
 * share moves as people join or drop out. `ship_diner_count` is written when the
 * day is locked and, once present, is used instead — that is what stops a
 * settled bill from shifting later.
 */
export async function getShipShares(
  where: { from: ServiceDate; to: ServiceDate } | { dates: ServiceDate[] },
): Promise<ShipShare[]> {
  const dayFilter =
    "dates" in where
      ? where.dates.length === 0
        ? null
        : inArray(menuDays.serviceDate, where.dates)
      : and(gte(menuDays.serviceDate, where.from), lte(menuDays.serviceDate, where.to));
  if (!dayFilter) return [];

  const days = await db
    .select({
      id: menuDays.id,
      serviceDate: menuDays.serviceDate,
      shipFeeVnd: menuDays.shipFeeVnd,
      shipDinerCount: menuDays.shipDinerCount,
    })
    .from(menuDays)
    .where(dayFilter);

  const charged = days.filter((day) => day.shipFeeVnd > 0);
  if (charged.length === 0) return [];

  const dinersByDay = await getDinerIds(charged.map((day) => day.id));

  const shares: ShipShare[] = [];
  for (const day of charged) {
    const diners = dinersByDay.get(day.id) ?? [];
    if (diners.length === 0) continue;

    // A locked day keeps the headcount it was locked with, even if the live
    // diner list would now divide differently.
    const parts = day.shipDinerCount ?? diners.length;
    const amounts = splitEvenly(day.shipFeeVnd, parts);

    diners.forEach((userId, index) => {
      const shareVnd = amounts[index];
      if (shareVnd) {
        shares.push({ userId, serviceDate: day.serviceDate, menuDayId: day.id, shareVnd });
      }
    });
  }
  return shares;
}

/** Freezes the headcount a day's ship fee is divided by. Called when locking. */
export async function freezeShipDinerCount(menuDayId: string): Promise<void> {
  const diners = (await getDinerIds([menuDayId])).get(menuDayId) ?? [];
  await db
    .update(menuDays)
    .set({ shipDinerCount: diners.length })
    .where(eq(menuDays.id, menuDayId));
}

/** Clears the frozen headcount so an unlocked day splits live again. */
export async function clearShipDinerCount(menuDayId: string): Promise<void> {
  await db.update(menuDays).set({ shipDinerCount: null }).where(eq(menuDays.id, menuDayId));
}

export type KitchenLine = {
  menuItemId: string;
  itemName: string;
  category: MenuItemCategory;
  priceVnd: number;
  totalQuantity: number;
};

/**
 * Headcount per dish for one menu — what you send to the restaurant.
 *
 * Keyed on the menu rather than the date: lunch and an afternoon party go to
 * different kitchens at different times, and one combined list would be wrong
 * for both.
 */
export async function getKitchenSummary(menuDayId: string): Promise<KitchenLine[]> {
  return db
    .select({
      menuItemId: menuItems.id,
      itemName: menuItems.name,
      category: menuItems.category,
      priceVnd: menuItems.priceVnd,
      totalQuantity: sql<number>`coalesce(sum(${bookings.quantity}), 0)::int`,
    })
    .from(menuItems)
    .leftJoin(
      bookings,
      and(eq(bookings.menuItemId, menuItems.id), eq(bookings.status, "booked")),
    )
    .where(eq(menuItems.menuDayId, menuDayId))
    .groupBy(
      menuItems.id,
      menuItems.name,
      menuItems.category,
      menuItems.priceVnd,
      menuItems.sortOrder,
    )
    .orderBy(asc(menuItems.sortOrder), asc(menuItems.name));
}

/** How many complete sets to order for a menu. */
export async function getSetCountForDay(menuDayId: string): Promise<number> {
  const row = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dayOrders)
    .where(eq(dayOrders.menuDayId, menuDayId))
    .then((rows) => rows[0]);

  return Number(row?.count ?? 0);
}

export type PersonLine = {
  userId: string;
  displayName: string | null;
  email: string;
  itemName: string;
  category: MenuItemCategory;
  quantity: number;
  unitPriceVnd: number;
  note: string | null;
};

/** Per-person breakdown for one menu — who ordered what. */
export async function getDayBookingsByPerson(menuDayId: string): Promise<PersonLine[]> {
  return db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      itemName: menuItems.name,
      category: menuItems.category,
      quantity: bookings.quantity,
      unitPriceVnd: bookings.unitPriceVnd,
      note: bookings.note,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.userId))
    .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
    .where(and(eq(bookings.menuDayId, menuDayId), eq(bookings.status, "booked")))
    .orderBy(asc(users.displayName), asc(users.email), asc(menuItems.sortOrder));
}

export type DayOrderPerson = {
  userId: string;
  displayName: string | null;
  email: string;
  setPriceVnd: number;
  setTier: SetTierKey;
};

/** Who has a complete set for a menu, with the price each locked in. */
export async function getDayOrdersByPerson(menuDayId: string): Promise<DayOrderPerson[]> {
  return db
    .select({
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      setPriceVnd: dayOrders.setPriceVnd,
      setTier: dayOrders.setTier,
    })
    .from(dayOrders)
    .innerJoin(users, eq(users.id, dayOrders.userId))
    .where(eq(dayOrders.menuDayId, menuDayId))
    .orderBy(asc(users.displayName), asc(users.email));
}

/**
 * Recomputes whether a user's set for a day is complete and writes the result.
 *
 * Called after every set-dish change. A complete set gets a `day_orders` row
 * snapshotting the price of the tier it completed; an incomplete one has its row
 * removed, so an abandoned half-selection is never billed. The snapshot is
 * deliberately not refreshed while the tier stays the same — a price edit must
 * not move an existing bill — but switching tier is a different suất, so that
 * does re-price.
 */
export async function syncDayOrder(
  userId: string,
  menuDayId: string,
): Promise<{ complete: boolean }> {
  const day = await db.query.menuDays.findFirst({
    where: eq(menuDays.id, menuDayId),
  });
  if (!day) return { complete: false };

  const counts = await getSetSelectionCounts(userId, menuDayId);
  const tier = resolveSetTier(day, counts);

  if (tier) {
    await db
      .insert(dayOrders)
      .values({ userId, menuDayId, setTier: tier.key, setPriceVnd: tier.priceVnd })
      .onConflictDoUpdate({
        target: [dayOrders.userId, dayOrders.menuDayId],
        set: { setTier: tier.key, setPriceVnd: tier.priceVnd, updatedAt: new Date() },
        // Only a move between the day's suất rewrites the snapshot. Re-completing
        // the same tier leaves the price the diner was quoted alone.
        setWhere: ne(dayOrders.setTier, tier.key),
      });
  } else {
    await db
      .delete(dayOrders)
      .where(and(eq(dayOrders.userId, userId), eq(dayOrders.menuDayId, menuDayId)));
  }

  return { complete: Boolean(tier) };
}

/**
 * Re-evaluates every diner's set for a day.
 *
 * Needed whenever the shape of the day changes underneath people who have
 * already picked — new required counts, a dish moved to another category, a dish
 * deleted. Without this a set that no longer satisfies the rules would keep its
 * `day_orders` row and stay billed.
 */
export async function resyncDayOrders(menuDayId: string): Promise<void> {
  const diners = await db
    .selectDistinct({ userId: bookings.userId })
    .from(bookings)
    .where(and(eq(bookings.menuDayId, menuDayId), eq(bookings.status, "booked")));

  for (const { userId } of diners) {
    await syncDayOrder(userId, menuDayId);
  }
}

export type SetSelectionCounts = { main: number; side: number; veg: number };

/** How many dishes a user has picked from each set category for a day. */
export async function getSetSelectionCounts(
  userId: string,
  menuDayId: string,
): Promise<SetSelectionCounts> {
  const rows = await db
    .select({
      category: menuItems.category,
      count: sql<number>`count(*)::int`,
    })
    .from(bookings)
    .innerJoin(menuItems, eq(menuItems.id, bookings.menuItemId))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.menuDayId, menuDayId),
        eq(bookings.status, "booked"),
      ),
    )
    .groupBy(menuItems.category);

  const counts: SetSelectionCounts = { main: 0, side: 0, veg: 0 };
  for (const row of rows) {
    if (row.category === "main" || row.category === "side" || row.category === "veg") {
      counts[row.category] = Number(row.count);
    }
  }
  return counts;
}
