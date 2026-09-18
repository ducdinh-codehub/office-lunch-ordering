"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { bookings, menuDays, menuItems } from "@/db/schema";
import { isBookingOpen, bookingClosedReason } from "@/db/queries/menu";
import { getSetSelectionCounts, syncDayOrder } from "@/db/queries/bookings";
import { getCurrentUser } from "@/lib/auth/session";
import {
  actionOk,
  fail,
  toActionError,
  type ActionResult,
} from "@/lib/action-result";

const bookSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().min(0).max(10),
  note: z.string().trim().max(200).optional(),
});

const toggleSchema = z.object({
  menuItemId: z.string().uuid(),
  selected: z.boolean(),
});

const CATEGORY_LABEL = {
  main: "món chính",
  side: "món phụ",
  veg: "món rau",
} as const;

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

    const { menuItemId, selected } = toggleSchema.parse(input);

    const item = await loadItem(menuItemId);
    if (!item) fail("Món này không còn trong thực đơn.");
    if (item.category === "addon" || item.category === "drink") {
      fail("Món này được tính tiền riêng, không nằm trong suất.");
    }
    if (!isBookingOpen(item)) {
      fail(bookingClosedReason(item) ?? "Ngày này đã đóng đặt món.");
    }
    if (!item.isAvailable && selected) fail("Món này đã hết.");

    if (selected) {
      // Enforce the per-category limit here: the UI's disabled checkbox is only
      // a hint, and two tabs can race past it.
      const counts = await getSetSelectionCounts(user.id, item.menuDayId);
      const allowed = {
        main: item.requiredMain,
        side: item.requiredSide,
        veg: item.requiredVeg,
      }[item.category];

      if (counts[item.category] >= allowed) {
        fail(
          `Bạn đã chọn đủ ${allowed} ${CATEGORY_LABEL[item.category]}. Hãy bỏ bớt một món trước.`,
        );
      }

      await db
        .insert(bookings)
        .values({
          userId: user.id,
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
        .where(and(eq(bookings.userId, user.id), eq(bookings.menuItemId, menuItemId)));
    }

    await syncDayOrder(user.id, item.menuDayId);

    revalidateFor(item.serviceDate);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không lưu được lựa chọn của bạn.");
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

    const { menuItemId, quantity, note } = bookSchema.parse(input);

    const item = await loadItem(menuItemId);

    if (!item) fail("Món này không còn trong thực đơn.");
    if (item.category !== "addon" && item.category !== "drink") {
      fail("Món này thuộc suất — hãy chọn ở phần bên trên.");
    }
    if (!isBookingOpen(item)) {
      fail(bookingClosedReason(item) ?? "Ngày này đã đóng đặt món.");
    }
    if (!item.isAvailable && quantity > 0) fail("Món này đã hết.");

    if (quantity === 0) {
      await db
        .delete(bookings)
        .where(and(eq(bookings.userId, user.id), eq(bookings.menuItemId, menuItemId)));
    } else {
      await db
        .insert(bookings)
        .values({
          userId: user.id,
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
