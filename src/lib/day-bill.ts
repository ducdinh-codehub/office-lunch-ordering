import "server-only";

import {
  getDayBookingsByPerson,
  getDayOrdersByPerson,
  getKitchenSummary,
  getShipShares,
} from "@/db/queries/bookings";
import { getMenuDay } from "@/db/queries/menu";
import { getPaymentRoster, type PaymentState } from "@/db/queries/payments";
import type { ServiceDate } from "@/lib/date";
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
  /** What they are charged — the payment roster's figure, not re-added here. */
  totalVnd: number;
  /** Null when they owe nothing, e.g. a suất started and left short. */
  state: PaymentState | null;
};

export type DayBill = {
  date: ServiceDate;
  kitchen: KitchenBill;
  diners: DayBillDiner[];
  /** Sum of what the diners are charged; can differ from the quán's total. */
  dinersTotalVnd: number;
};

/**
 * One day's bill from both sides: what the quán is owed, and what each diner
 * owes and whether they have paid. Everything comes from the queries behind
 * the kitchen list and the payment roster, so the export never disagrees with
 * either page.
 */
export async function getDayBill(date: ServiceDate): Promise<DayBill> {
  const [kitchenLines, people, setOrders, day, roster, shipShares] = await Promise.all([
    getKitchenSummary(date),
    getDayBookingsByPerson(date),
    getDayOrdersByPerson(date),
    getMenuDay(date),
    getPaymentRoster(date, date),
    getShipShares({ dates: [date] }),
  ]);

  const shipByUser = new Map(shipShares.map((share) => [share.userId, share.shareVnd]));
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
        totalVnd: cell?.owedVnd ?? 0,
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
  return {
    date,
    kitchen: summarizeKitchenBill(kitchenLines, setOrders, day?.shipFeeVnd ?? 0),
    diners: list,
    dinersTotalVnd: list.reduce((total, diner) => total + diner.totalVnd, 0),
  };
}
