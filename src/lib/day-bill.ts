import "server-only";

import {
  getDayBookingsByPerson,
  getDayOrdersByPerson,
  getKitchenSummary,
  getShipShares,
} from "@/db/queries/bookings";
import { getMenuDay } from "@/db/queries/menu";
import { getPaymentRoster, type PaymentState } from "@/db/queries/payments";
import { envelopeKey, getEnvelopePercents } from "@/db/queries/lucky-envelopes";
import { luckyDiscountVnd } from "@/lib/lucky-envelope";
import type { ServiceDate } from "@/lib/date";
import { DEFAULT_SLOT, type MenuSlot } from "@/lib/menu-slot";
import { fallbackDisplayName } from "@/lib/display-name";
import { summarizeKitchenBill, type KitchenBill } from "@/lib/kitchen-bill";

export type DayBillDiner = {
  name: string;
  /** "Canh Cua x2" style, in the order they were booked. */
  dishes: string[];
  notes: string[];
  setVnd: number;
  extrasVnd: number;
  shipVnd: number;
  /**
   * What this sitting charges them: set + extras + ship, less their lì xì if
   * they opened it this date — the same parts the payment roster adds up. Not
   * the roster's figure itself — that is per date, so on a date with a party it
   * would carry both sittings' money. (On such a date the lì xì is rounded per
   * sitting here and per date there, so the two can differ by a đồng.)
   */
  totalVnd: number;
  /**
   * Null when they owe nothing, e.g. a suất started and left short. Payment is
   * per date, so a paid date marks both of its sittings paid.
   */
  state: PaymentState | null;
};

export type DayBill = {
  date: ServiceDate;
  slot: MenuSlot;
  kitchen: KitchenBill;
  diners: DayBillDiner[];
  /** Sum of what the diners are charged; can differ from the quán's total. */
  dinersTotalVnd: number;
};

/**
 * One sitting's bill from both sides: what the quán is owed, and what each
 * diner owes and whether they have paid. Everything comes from the queries
 * behind the kitchen list and the payment roster, so the export never disagrees
 * with either page.
 *
 * Scoped to one menu — lunch and the party go to the quán as separate orders.
 * A date with no menu for that sitting yields an empty bill.
 */
export async function getDayBill(
  date: ServiceDate,
  slot: MenuSlot = DEFAULT_SLOT,
): Promise<DayBill> {
  const day = await getMenuDay(date, slot);
  const menuDayId = day?.id;

  const [kitchenLines, people, setOrders, roster, shipShares, envelopes] = await Promise.all([
    menuDayId ? getKitchenSummary(menuDayId) : [],
    menuDayId ? getDayBookingsByPerson(menuDayId) : [],
    menuDayId ? getDayOrdersByPerson(menuDayId) : [],
    getPaymentRoster(date, date),
    getShipShares({ dates: [date] }),
    getEnvelopePercents({ dates: [date] }),
  ]);

  // A date with two sittings has a share per sitting; only this one's counts.
  const shipByUser = new Map(
    shipShares
      .filter((share) => share.menuDayId === menuDayId)
      .map((share) => [share.userId, share.shareVnd]),
  );
  const cellByUser = new Map(
    roster.rows.map((row) => [row.userId, row.cells.get(date) ?? null] as const),
  );

  const diners = new Map<string, DayBillDiner>();
  const dinerFor = (userId: string, displayName: string | null, email: string) => {
    let diner = diners.get(userId);
    if (!diner) {
      const cell = cellByUser.get(userId) ?? null;
      diner = {
        name: displayName ?? fallbackDisplayName(email),
        dishes: [],
        notes: [],
        setVnd: 0,
        extrasVnd: 0,
        shipVnd: shipByUser.get(userId) ?? 0,
        totalVnd: 0, // summed below, once every line is in
        state: cell && cell.owedVnd > 0 ? cell.state : null,
      };
      diners.set(userId, diner);
    }
    return diner;
  };

  // `people` arrives ordered by name, so the bill is too.
  for (const line of people) {
    const diner = dinerFor(line.userId, line.displayName, line.email);
    diner.dishes.push(line.quantity > 1 ? `${line.itemName} x${line.quantity}` : line.itemName);
    if (line.note) diner.notes.push(line.note);
    if (line.category === "addon" || line.category === "drink") {
      diner.extrasVnd += line.quantity * line.unitPriceVnd;
    }
  }
  for (const order of setOrders) {
    dinerFor(order.userId, order.displayName, order.email).setVnd += order.setPriceVnd;
  }

  const list = [...diners.values()];
  for (const [userId, diner] of diners) {
    const gross = diner.setVnd + diner.extrasVnd + diner.shipVnd;
    const percent = envelopes.get(envelopeKey(userId, date));
    diner.totalVnd = percent === undefined ? gross : gross - luckyDiscountVnd(gross, percent);
  }
  return {
    date,
    slot,
    kitchen: summarizeKitchenBill(kitchenLines, setOrders, day?.shipFeeVnd ?? 0),
    diners: list,
    dinersTotalVnd: list.reduce((total, diner) => total + diner.totalVnd, 0),
  };
}
