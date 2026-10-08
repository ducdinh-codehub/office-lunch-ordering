"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { manualBillItems, manualBills, users } from "@/db/schema";
import { getClaimedDates } from "@/db/queries/payments";
import { getCurrentUser } from "@/lib/auth/session";
import { isServiceDate } from "@/lib/date";
import {
  MANUAL_BILL_ITEM_NAME_MAX,
  MANUAL_BILL_MAX_ITEMS,
  MANUAL_BILL_MAX_TOTAL_VND,
  MANUAL_BILL_MAX_UNIT_PRICE_VND,
  MANUAL_BILL_TITLE_MAX,
} from "@/lib/manual-bill";
import { formatVnd } from "@/lib/money";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

const manualBillSchema = z.object({
  userId: z.string().uuid("Hãy chọn một người."),
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

/** Every page a hand-written bill changes an amount on. */
function revalidateMoneyPages() {
  revalidatePath("/");
  revalidatePath("/me/bookings");
  revalidatePath("/me/payments");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/bills");
}

/**
 * Writes a bill for one person by hand: a date, an optional time, and lines
 * whose names and prices the admin types. It joins that date's total, so the
 * person pays it with the rest of the day. Refused on a day they already
 * claimed — that amount is fixed on the payments row.
 */
export async function createManualBill(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { userId, serviceDate, serviceTime, title, items } = manualBillSchema.parse(input);

    // Recomputed here from the lines; nothing the client summed is trusted.
    const totalVnd = items.reduce((total, item) => total + item.quantity * item.unitPriceVnd, 0);
    if (totalVnd > MANUAL_BILL_MAX_TOTAL_VND) {
      fail(`Một hoá đơn tối đa ${formatVnd(MANUAL_BILL_MAX_TOTAL_VND)}.`);
    }

    const [member] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!member) fail("Không tìm thấy người này.");

    if ((await getClaimedDates(userId, [serviceDate])).size > 0) {
      fail("Người này đã thanh toán ngày đó — chọn ngày khác cho hoá đơn.");
    }

    // Two inserts without a transaction (the Neon HTTP driver has none): if the
    // lines fail, the empty bill is taken back rather than left at 0 ₫.
    const billId = randomUUID();
    await db.insert(manualBills).values({
      id: billId,
      userId,
      serviceDate,
      serviceTime,
      title,
      createdByUserId: user.id,
    });
    try {
      await db
        .insert(manualBillItems)
        .values(items.map((item, index) => ({ billId, ...item, sortOrder: index })));
    } catch (cause) {
      await db.delete(manualBills).where(eq(manualBills.id, billId));
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
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

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
