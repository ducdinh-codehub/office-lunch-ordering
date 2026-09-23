import type { MenuDay, MenuSlot } from "@/db/schema";

export type { MenuSlot };

/** Both sittings a date can hold, in the order they happen. */
export const MENU_SLOTS = ["lunch", "afternoon"] as const satisfies readonly MenuSlot[];

/** The sitting every existing day is on, and the one a link without `buoi` means. */
export const DEFAULT_SLOT: MenuSlot = "lunch";

export const SLOT_LABEL: Record<MenuSlot, string> = {
  lunch: "Bữa trưa",
  afternoon: "Tiệc chiều",
};

/** How the order sent to the quán introduces itself. */
export const SLOT_ORDER_LABEL: Record<MenuSlot, string> = {
  lunch: "Đơn cơm trưa",
  afternoon: "Đơn tiệc chiều",
};

/**
 * The `buoi` query parameter, kept only when it names a real sitting.
 *
 * Anything else — absent, misspelt, left over from an old link — reads as lunch,
 * so every URL written before the afternoon menu existed still lands where it
 * always did.
 */
export function parseMenuSlot(value: string | undefined): MenuSlot {
  return value === "afternoon" ? "afternoon" : DEFAULT_SLOT;
}

/**
 * Appends the sitting to a URL, but only when it is not the default — lunch
 * links stay exactly as short as they were.
 */
export function withSlot(path: string, slot: MenuSlot): string {
  if (slot === DEFAULT_SLOT) return path;
  return `${path}${path.includes("?") ? "&" : "?"}buoi=${slot}`;
}

/** The two fields that decide which sitting a date is currently serving. */
export type SlotState = Pick<MenuDay, "slot" | "status">;

/**
 * The sitting a date is serving right now — what a link with no `buoi` lands on.
 *
 * Lunch, until the admin locks it: once the lunch order is with the quán there
 * is nothing left to do with that menu, so an afternoon party already published
 * takes over the day. A party still in draft does not — there would be nothing
 * to show — and neither does one on a day whose lunch is still taking orders.
 */
export function resolveActiveSlot(days: SlotState[]): MenuSlot {
  const lunch = days.find((day) => day.slot === "lunch");
  const party = days.find((day) => day.slot === "afternoon");

  if (lunch?.status === "locked" && party?.status === "open") return "afternoon";
  return DEFAULT_SLOT;
}

/**
 * The `buoi` parameter when it was actually given, `null` when it was not.
 *
 * The difference matters: an explicit `?buoi=lunch` means "show me lunch even
 * though the party has taken over the day", while no parameter at all defers to
 * `resolveActiveSlot`.
 */
export function parseMenuSlotParam(value: string | undefined): MenuSlot | null {
  if (value === "lunch" || value === "afternoon") return value;
  return null;
}

/**
 * Why a pair of deadlines is invalid, or null when it is fine.
 *
 * The afternoon party closes strictly after lunch does. The party happens once
 * the working day's lunch is already eaten, so a party deadline at or before
 * lunch's would be unreachable in practice — and on the same instant there is
 * no telling which order is still open. A missing deadline is not an early one:
 * it means that sitting has no deadline at all.
 */
export function cutoffOrderError(
  lunchCutoff: Date | null,
  partyCutoff: Date | null,
): string | null {
  if (!lunchCutoff || !partyCutoff) return null;
  if (partyCutoff.getTime() > lunchCutoff.getTime()) return null;
  return "Hạn đặt tiệc chiều phải muộn hơn hạn đặt bữa trưa.";
}
