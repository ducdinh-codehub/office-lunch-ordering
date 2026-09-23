"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { bookings, menuDays, menuItems, users, SET_CATEGORIES } from "@/db/schema";
import { isBookingOpen, bookingClosedReason } from "@/db/queries/menu";
import { getSetSelectionCounts, syncDayOrder } from "@/db/queries/bookings";
import { maxSetPicks, offersSet, resolveSetTier, setTiers } from "@/lib/set-tiers";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import {
  actionOk,
  fail,
  toActionError,
  type ActionResult,
} from "@/lib/action-result";

const bookSchema = z.object({
  menuItemId: z.string().uuid(),
  /** Admin ordering for someone else; absent means "for myself". */
  onBehalfOf: z.string().uuid().optional(),
  // No product limit on how many portions of a dish someone orders — 0 removes
  // the booking, 1 is the smallest real order. The ceiling is only arithmetic
  // safety: quantity × unit price has to stay inside a 32-bit integer, which is
  // the invariant that keeps money exact.
  quantity: z.number().int().min(0).max(99),
  note: z.string().trim().max(200).optional(),
});

const toggleSchema = z.object({
  menuItemId: z.string().uuid(),
  onBehalfOf: z.string().uuid().optional(),
  selected: z.boolean(),
});

const CATEGORY_LABEL = {
  main: "món chính",
  side: "món phụ",
  veg: "món rau",
} as const;

/**
 * Who this booking is for.
 *
 * An admin may order on someone else's behalf — the colleague who asked in
 * person, or the one who missed the cutoff. Everyone else may only ever book
 * for themselves, so an `onBehalfOf` from a non-admin is refused rather than
 * ignored. The override also lifts the cutoff: booking late on someone's behalf
 * is the whole reason the admin is doing it by hand.
 */
async function resolveDiner(
  actor: SessionUser,
  onBehalfOf: string | undefined,
): Promise<{ userId: string; overrideCutoff: boolean }> {
  if (!onBehalfOf || onBehalfOf === actor.id) {
    return { userId: actor.id, overrideCutoff: false };
  }
  if (!actor.isAdmin) fail("Bạn không có quyền đặt món cho người khác.");

  const target = await db.query.users.findFirst({ where: eq(users.id, onBehalfOf) });
  if (!target) fail("Không tìm thấy người này.");
  return { userId: target.id, overrideCutoff: true };
}

/** The dish plus the day it belongs to — every rule-check input in one row. */
async function loadItem(menuItemId: string) {
  return db
    .select({
      id: menuItems.id,
      menuDayId: menuItems.menuDayId,
      name: menuItems.name,
      category: menuItems.category,
      priceVnd: menuItems.priceVnd,
      isAvailable: menuItems.isAvailable,
      serviceDate: menuDays.serviceDate,
      status: menuDays.status,
      orderCutoff: menuDays.orderCutoff,
      requiredMain: menuDays.requiredMain,
      requiredSide: menuDays.requiredSide,
      requiredVeg: menuDays.requiredVeg,
      setPriceVnd: menuDays.setPriceVnd,
      altSetPriceVnd: menuDays.altSetPriceVnd,
      altRequiredMain: menuDays.altRequiredMain,
      altRequiredSide: menuDays.altRequiredSide,
      altRequiredVeg: menuDays.altRequiredVeg,
    })
    .from(menuItems)
    .innerJoin(menuDays, eq(menuDays.id, menuItems.menuDayId))
    .where(eq(menuItems.id, menuItemId))
    .then((rows) => rows[0]);
}

function revalidateFor(serviceDate: string) {
  revalidatePath("/");
  revalidatePath(`/menu/${serviceDate}`);
  revalidatePath("/me/bookings");
  revalidatePath("/me/payments");
}

/**
 * Picks or drops one dish of the fixed-price set (món chính / phụ / rau).
 *
 * Quantity is always 1 — a set slot is either taken or it isn't — and the price
 * snapshot is 0 because the set price covers it. After every change the day's
 * set is re-evaluated: a complete set gets billed, an unfinished one does not.
 */
export async function toggleSetDish(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");

    const { menuItemId, selected, onBehalfOf } = toggleSchema.parse(input);
    const diner = await resolveDiner(user, onBehalfOf);

    const item = await loadItem(menuItemId);
    if (!item) fail("Món này không còn trong thực đơn.");
    if (item.category === "addon" || item.category === "drink") {
      fail("Món này được tính tiền riêng, không nằm trong suất.");
    }
    if (!diner.overrideCutoff && !isBookingOpen(item)) {
      fail(bookingClosedReason(item) ?? "Ngày này đã đóng đặt món.");
    }
    if (!item.isAvailable && selected) fail("Món này đã hết.");

    if (selected) {
      // Enforce the per-category limit here: the UI's disabled checkbox is only
      // a hint, and two tabs can race past it. The cap is the most generous suất
      // the day offers — with a 1-món-chính suất beside a 2-món-chính one, the
      // diner has to be able to reach either.
      const counts = await getSetSelectionCounts(diner.userId, item.menuDayId);
      const allowed = maxSetPicks(item)[item.category];

      if (counts[item.category] >= allowed) {
        fail(
          `Bạn đã chọn tối đa ${allowed} ${CATEGORY_LABEL[item.category]}. Hãy bỏ bớt một món trước.`,
        );
      }

      await db
        .insert(bookings)
        .values({
          userId: diner.userId,
          menuDayId: item.menuDayId,
          menuItemId: item.id,
          quantity: 1,
          // Covered by the set price, so this line is worth nothing on its own.
          unitPriceVnd: 0,
          status: "booked",
        })
        .onConflictDoUpdate({
          target: [bookings.userId, bookings.menuItemId],
          set: { quantity: 1, status: "booked", updatedAt: new Date() },
        });
    } else {
      await db
        .delete(bookings)
        .where(and(eq(bookings.userId, diner.userId), eq(bookings.menuItemId, menuItemId)));
    }

    await syncDayOrder(diner.userId, item.menuDayId);

    revalidateFor(item.serviceDate);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không lưu được lựa chọn của bạn.");
  }
}

const switchTierSchema = z.object({
  // The menu, not the date: a date can hold a lunch and an afternoon party, and
  // each sells its own suất.
  menuDayId: z.string().uuid(),
  tier: z.enum(["full", "alt"]),
  onBehalfOf: z.string().uuid().optional(),
});

/**
 * Moves the diner to the day's other suất, clearing the set dishes they had
 * picked for the one they are leaving.
 *
 * Switching is a fresh start by design: the two suất take different numbers of
 * món chính, so carrying picks across would leave a selection that is over quota
 * for the new suất and has to be pruned by hand. Only the set dishes go — "gọi
 * thêm" and drinks are priced per portion, not part of any suất, and nobody
 * expects their drink cancelled for changing the rice.
 */
export async function switchSetTier(
  input: unknown,
): Promise<ActionResult<{ cleared: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");

    const { menuDayId, tier, onBehalfOf } = switchTierSchema.parse(input);
    const diner = await resolveDiner(user, onBehalfOf);

    const day = await db.query.menuDays.findFirst({ where: eq(menuDays.id, menuDayId) });
    if (!day) fail("Chưa có thực đơn cho ngày này.");
    if (!diner.overrideCutoff && !isBookingOpen(day)) {
      fail(bookingClosedReason(day) ?? "Ngày này đã đóng đặt món.");
    }
    if (!setTiers(day).some((option) => option.key === tier)) {
      fail("Ngày này không có suất đó.");
    }

    const setDishes = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.menuDayId, day.id),
          inArray(menuItems.category, [...SET_CATEGORIES]),
        ),
      );

    let cleared = 0;
    if (setDishes.length > 0) {
      const removed = await db
        .delete(bookings)
        .where(
          and(
            eq(bookings.userId, diner.userId),
            eq(bookings.menuDayId, day.id),
            inArray(
              bookings.menuItemId,
              setDishes.map((dish) => dish.id),
            ),
          ),
        )
        .returning({ id: bookings.id });
      cleared = removed.length;
    }

    // Nothing is left of the old suất, so the day_orders row goes with it.
    await syncDayOrder(diner.userId, day.id);

    revalidateFor(day.serviceDate);
    return actionOk({ cleared });
  } catch (cause) {
    return toActionError(cause, "Không đổi được suất.");
  }
}

/**
 * Creates, updates, or removes a booking for one separately-priced dish —
 * "Gọi thêm" and "Đồ uống". Quantity 0 removes it.
 *
 * Every rule is enforced here, server-side; the UI's disabled states are only a
 * hint.
 */
export async function setBooking(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");

    const { menuItemId, quantity, note, onBehalfOf } = bookSchema.parse(input);
    const diner = await resolveDiner(user, onBehalfOf);

    const item = await loadItem(menuItemId);

    if (!item) fail("Món này không còn trong thực đơn.");
    if (item.category !== "addon" && item.category !== "drink") {
      fail("Món này thuộc suất — hãy chọn ở phần bên trên.");
    }
    if (!diner.overrideCutoff && !isBookingOpen(item)) {
      fail(bookingClosedReason(item) ?? "Ngày này đã đóng đặt món.");
    }
    if (!item.isAvailable && quantity > 0) fail("Món này đã hết.");

    // "Gọi thêm" is an extra on top of a suất, not a meal on its own: it only
    // opens once the set is complete. Removing (quantity 0) always works, so a
    // dish picked earlier can still be dropped if the set falls apart.
    if (item.category === "addon" && quantity > 0) {
      if (offersSet(item)) {
        const counts = await getSetSelectionCounts(diner.userId, item.menuDayId);
        // Any of the day's suất counts as complete — a 40.000 ₫ one just as much
        // as a 50.000 ₫ one.
        if (!resolveSetTier(item, counts)) fail("Hãy chọn đủ suất trước khi gọi thêm món.");
      }
    }

    if (quantity === 0) {
      await db
        .delete(bookings)
        .where(and(eq(bookings.userId, diner.userId), eq(bookings.menuItemId, menuItemId)));
    } else {
      await db
        .insert(bookings)
        .values({
          userId: diner.userId,
          menuDayId: item.menuDayId,
          menuItemId: item.id,
          quantity,
          // Snapshot: a later price edit must not change this bill.
          unitPriceVnd: item.priceVnd,
          note: note || null,
          status: "booked",
        })
        .onConflictDoUpdate({
          target: [bookings.userId, bookings.menuItemId],
          set: {
            quantity,
            note: note || null,
            status: "booked",
            updatedAt: new Date(),
          },
        });
    }

    revalidateFor(item.serviceDate);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không lưu được lựa chọn của bạn.");
  }
}
