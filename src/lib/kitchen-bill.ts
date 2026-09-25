import type { DayOrderPerson, KitchenLine } from "@/db/queries/bookings";
import type { MenuItemCategory } from "@/db/schema";

/** The order the quán reads a day in, set dishes first. */
export const KITCHEN_SECTIONS = [
  { category: "main", label: "Món chính" },
  { category: "side", label: "Món phụ" },
  { category: "veg", label: "Món rau" },
  { category: "addon", label: "Gọi thêm" },
  { category: "drink", label: "Đồ uống" },
] as const satisfies ReadonlyArray<{ category: MenuItemCategory; label: string }>;

export type SetGroup = { priceVnd: number; count: number };

export type KitchenBill = {
  /** Kitchen lines someone actually ordered. */
  ordered: KitchenLine[];
  /** Suất grouped by the price each was snapshotted at, dearest first. */
  setGroups: SetGroup[];
  setTotalVnd: number;
  /** Add-ons and drinks — the only lines billed per portion. */
  paidTotalVnd: number;
  shipFeeVnd: number;
  /** What the quán is owed for the day. */
  totalVnd: number;
  totalDishes: number;
};

/**
 * The day's bill from the quán's side — shared by the kitchen list page and its
 * Excel export so the two can never disagree about money.
 */
export function summarizeKitchenBill(
  kitchen: KitchenLine[],
  setOrders: DayOrderPerson[],
  shipFeeVnd: number,
): KitchenBill {
  const ordered = kitchen.filter((line) => line.totalQuantity > 0);

  // Set dishes are covered by the suất price; only add-ons and drinks are billed
  // per portion, so the day's money is sets + paid lines.
  const setTotalVnd = setOrders.reduce((total, order) => total + order.setPriceVnd, 0);
  // A day can sell two suất, and a price edit can leave older snapshots behind,
  // so the quán is told how many of each price rather than one bare headcount.
  const setGroups = [
    ...setOrders
      .reduce(
        (groups, order) => groups.set(order.setPriceVnd, (groups.get(order.setPriceVnd) ?? 0) + 1),
        new Map<number, number>(),
      )
      .entries(),
  ]
    .map(([priceVnd, count]) => ({ priceVnd, count }))
    .sort((a, b) => b.priceVnd - a.priceVnd);
  const paidTotalVnd = ordered
    .filter((line) => line.category === "addon" || line.category === "drink")
    .reduce((total, line) => total + line.totalQuantity * line.priceVnd, 0);

  return {
    ordered,
    setGroups,
    setTotalVnd,
    paidTotalVnd,
    shipFeeVnd,
    // The quán charges the delivery once for the whole order, not per person.
    totalVnd: setTotalVnd + paidTotalVnd + shipFeeVnd,
    totalDishes: ordered.reduce((total, line) => total + line.totalQuantity, 0),
  };
}
