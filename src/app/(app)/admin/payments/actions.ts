"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { bookings, dayOrders, menuDays, payments } from "@/db/schema";
import { getUserTotalsForDates } from "@/db/queries/bookings";
import { getCurrentUser } from "@/lib/auth/session";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
  if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");
  return user;
}

function revalidatePayments() {
  revalidatePath("/admin/payments");
  revalidatePath("/me/payments");
  revalidatePath("/");
}

const decisionSchema = z.object({
  claimId: z.string().uuid(),
  decision: z.enum(["confirmed", "rejected"]),
  note: z.string().trim().max(200).optional(),
});

/** Confirm or reject a whole bank transfer at once. Idempotent by design. */
export async function decideClaim(input: unknown): Promise<ActionResult<{ count: number }>> {
  try {
    const admin = await assertAdmin();
    const { claimId, decision, note } = decisionSchema.parse(input);

    const updated = await db
      .update(payments)
      .set({
        status: decision,
        confirmedAt: new Date(),
        confirmedByUserId: admin.id,
        ...(note ? { note } : {}),
      })
      .where(and(eq(payments.claimId, claimId), eq(payments.status, "pending")))
      .returning({ id: payments.id });

    if (updated.length === 0) fail("Yêu cầu này đã được duyệt rồi.");

    revalidatePayments();
    return actionOk({ count: updated.length });
  } catch (cause) {
    return toActionError(cause, "Không ghi nhận được quyết định.");
  }
}

const markPaidSchema = z.object({
  userId: z.string().uuid(),
  serviceDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(62),
});

/**
 * Admin override: mark days paid directly, for people who handed over cash or
 * paid outside the app. Amounts are recomputed from bookings, never supplied.
 */
export async function markPaidByAdmin(
  input: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const admin = await assertAdmin();
    const { userId, serviceDates } = markPaidSchema.parse(input);
    const uniqueDates = [...new Set(serviceDates)];

    const totals = await getUserTotalsForDates(userId, uniqueDates);
    const payable = uniqueDates.filter((date) => (totals.get(date) ?? 0) > 0);
    if (payable.length === 0) fail("Những ngày đó không còn khoản nào phải trả.");

    const claimId = randomUUID();
    const now = new Date();

    await db
      .insert(payments)
      .values(
        payable.map((serviceDate) => ({
          userId,
          serviceDate,
          amountVnd: totals.get(serviceDate)!,
          status: "confirmed" as const,
          claimId,
          claimedAt: now,
          confirmedAt: now,
          confirmedByUserId: admin.id,
          note: "Quản trị viên đánh dấu đã trả",
        })),
      )
      .onConflictDoUpdate({
        target: [payments.userId, payments.serviceDate],
        set: {
          amountVnd: sql`excluded.amount_vnd`,
          status: "confirmed",
          confirmedAt: now,
          confirmedByUserId: admin.id,
        },
      });

    revalidatePayments();
    return actionOk({ count: payable.length });
  } catch (cause) {
    return toActionError(cause, "Không đánh dấu được những ngày đó là đã trả.");
  }
}

/** Undo a confirmation — removes the payment rows so the days go back to unpaid. */
export async function unmarkPaid(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { userId, serviceDates } = markPaidSchema.parse(input);

    await db
      .delete(payments)
      .where(
        and(eq(payments.userId, userId), inArray(payments.serviceDate, serviceDates)),
      );

    revalidatePayments();
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không hoàn tác được.");
  }
}

const deleteOrderSchema = z.object({
  userId: z.string().uuid(),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Removes one person's order for one day — someone who was away, or a day
 * entered by mistake. Their dishes, their set, and any unconfirmed claim for
 * that date go; they stop owing for it.
 *
 * A day already confirmed as paid is refused: the money is in, so deleting the
 * order would leave a payment with nothing behind it. Undo the payment first.
 */
export async function deleteDayOrder(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { userId, serviceDate } = deleteOrderSchema.parse(input);

    const confirmed = await db.query.payments.findFirst({
      where: and(
        eq(payments.userId, userId),
        eq(payments.serviceDate, serviceDate),
        eq(payments.status, "confirmed"),
      ),
    });
    if (confirmed) {
      fail("Ngày này đã xác nhận trả tiền. Hãy bỏ đánh dấu đã trả trước khi xoá đơn.");
    }

    const day = await db.query.menuDays.findFirst({
      where: eq(menuDays.serviceDate, serviceDate),
    });
    if (!day) fail("Không tìm thấy thực đơn của ngày này.");

    await db
      .delete(bookings)
      .where(and(eq(bookings.userId, userId), eq(bookings.menuDayId, day.id)));
    await db
      .delete(dayOrders)
      .where(and(eq(dayOrders.userId, userId), eq(dayOrders.menuDayId, day.id)));
    // A pending or rejected claim for a day with no order is a claim for
    // nothing; confirmed ones were refused above.
    await db
      .delete(payments)
      .where(and(eq(payments.userId, userId), eq(payments.serviceDate, serviceDate)));

    revalidatePayments();
    revalidatePath("/me/bookings");
    revalidatePath(`/menu/${serviceDate}`);
    revalidatePath(`/admin/bookings/${serviceDate}`);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không xoá được đơn của ngày này.");
  }
}
