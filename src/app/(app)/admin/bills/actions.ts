"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { manualBillItems, manualBills, users } from "@/db/schema";
import { getClaimedDates, getUsersClaimedOn } from "@/db/queries/payments";
import { assertSection } from "@/lib/auth/session";
import { isServiceDate } from "@/lib/date";
import {
  MANUAL_BILL_ITEM_NAME_MAX,
  MANUAL_BILL_MAX_ITEMS,
  MANUAL_BILL_MAX_PEOPLE,
  MANUAL_BILL_MAX_TOTAL_VND,
  MANUAL_BILL_MAX_UNIT_PRICE_VND,
  MANUAL_BILL_TITLE_MAX,
} from "@/lib/manual-bill";
import { fallbackDisplayName } from "@/lib/display-name";
import { formatVnd } from "@/lib/money";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

const manualBillSchema = z.object({
  // Each person gets a bill of their own with the same lines — one round of
  // trà sữa written once for everyone who had it.
  userIds: z
    .array(z.string().uuid("Người được chọn không hợp lệ."))
    .min(1, "Hãy chọn ít nhất một người.")
    .max(MANUAL_BILL_MAX_PEOPLE, `Mỗi lần ghi tối đa ${MANUAL_BILL_MAX_PEOPLE} người.`)
    .transform((ids) => [...new Set(ids)]),
  serviceDate: z.string().refine(isServiceDate, "Ngày không hợp lệ."),
  // A `<input type="time">` value, Vietnam wall-clock; empty means no time.
  serviceTime: z
    .string()
    .regex(/^(?:|([01]\d|2[0-3]):[0-5]\d)$/, "Giờ không hợp lệ.")
    .transform((time) => time || null),
  title: z
    .string()
    .trim()
    .max(MANUAL_BILL_TITLE_MAX, `Tiêu đề tối đa ${MANUAL_BILL_TITLE_MAX} ký tự.`)
    .transform((title) => title || null),
  items: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(1, "Món nào cũng cần có tên.")
          .max(MANUAL_BILL_ITEM_NAME_MAX, `Tên món tối đa ${MANUAL_BILL_ITEM_NAME_MAX} ký tự.`),
        quantity: z
          .number()
          .int("Số lượng phải là số nguyên.")
          .min(1, "Số lượng ít nhất là 1.")
          .max(99, "Số lượng nhiều nhất là 99."),
        unitPriceVnd: z
          .number()
          .int("Giá phải là số nguyên.")
          .min(0, "Giá không được âm.")
          .max(
            MANUAL_BILL_MAX_UNIT_PRICE_VND,
            `Giá mỗi món tối đa ${formatVnd(MANUAL_BILL_MAX_UNIT_PRICE_VND)}.`,
          ),
      }),
    )
    .min(1, "Hoá đơn cần ít nhất một món.")
    .max(MANUAL_BILL_MAX_ITEMS, `Mỗi hoá đơn tối đa ${MANUAL_BILL_MAX_ITEMS} món.`),
});

/** Every page a hand-written bill changes an amount on, or is listed on. */
function revalidateMoneyPages() {
  revalidatePath("/");
  revalidatePath("/me/bookings");
  revalidatePath("/me/payments");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/bills");
  revalidatePath("/admin/bookings", "layout");
}

/**
 * Writes a bill by hand for one or more people: a date, an optional time, and
 * lines whose names and prices the admin types. Every person chosen gets their
 * own bill with those lines — each joins that person's total for the date, so
 * they pay it with the rest of the day. Refused as a whole if any of them
 * already claimed that date — their amount is fixed on the payments row.
 */
export async function createManualBill(input: unknown): Promise<ActionResult> {
  try {
    const user = await assertSection("bills");

    const { userIds, serviceDate, serviceTime, title, items } = manualBillSchema.parse(input);

    // Recomputed here from the lines; nothing the client summed is trusted.
    const totalVnd = items.reduce((total, item) => total + item.quantity * item.unitPriceVnd, 0);
    if (totalVnd > MANUAL_BILL_MAX_TOTAL_VND) {
      fail(`Một hoá đơn tối đa ${formatVnd(MANUAL_BILL_MAX_TOTAL_VND)}.`);
    }

    const members = await db
      .select({ id: users.id, displayName: users.displayName, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    if (members.length !== userIds.length) fail("Không tìm thấy một người đã chọn.");

    const claimed = await getUsersClaimedOn(userIds, serviceDate);
    if (claimed.size > 0) {
      const names = members
        .filter((member) => claimed.has(member.id))
        .map((member) => member.displayName || fallbackDisplayName(member.email));
      fail(`${names.join(", ")} đã thanh toán ngày đó — bỏ chọn hoặc chọn ngày khác.`);
    }

    // Two inserts without a transaction (the Neon HTTP driver has none): if the
    // lines fail, the empty bills are taken back rather than left at 0 ₫.
    const billIds = userIds.map(() => randomUUID());
    await db.insert(manualBills).values(
      userIds.map((userId, index) => ({
        id: billIds[index],
        userId,
        serviceDate,
        serviceTime,
        title,
        createdByUserId: user.id,
      })),
    );
    try {
      await db
        .insert(manualBillItems)
        .values(
          billIds.flatMap((billId) =>
            items.map((item, index) => ({ billId, ...item, sortOrder: index })),
          ),
        );
    } catch (cause) {
      await db.delete(manualBills).where(inArray(manualBills.id, billIds));
      throw cause;
    }

    revalidateMoneyPages();
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return {
        ok: false,
        error: cause.issues[0]?.message ?? "Thông tin hoá đơn chưa đúng.",
      };
    }
    return toActionError(cause, "Không lưu được hoá đơn.");
  }
}

/**
 * Takes a hand-written bill back. Refused on a claimed day for the same reason
 * writing one is.
 */
export async function deleteManualBill(input: unknown): Promise<ActionResult> {
  try {
    await assertSection("bills");

    const { id } = z.object({ id: z.string().uuid() }).parse(input);

    const [bill] = await db
      .select({
        userId: manualBills.userId,
        serviceDate: manualBills.serviceDate,
      })
      .from(manualBills)
      .where(eq(manualBills.id, id))
      .limit(1);
    if (!bill) fail("Hoá đơn này không còn nữa.");

    if ((await getClaimedDates(bill.userId, [bill.serviceDate])).size > 0) {
      fail("Người này đã thanh toán ngày đó — hoá đơn không xoá được nữa.");
    }

    // The lines go with it (on delete cascade).
    await db.delete(manualBills).where(eq(manualBills.id, id));

    revalidateMoneyPages();
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không xoá được hoá đơn.");
  }
}
