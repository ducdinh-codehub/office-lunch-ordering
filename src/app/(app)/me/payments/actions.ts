"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { payments } from "@/db/schema";
import { getUserTotalsForDates } from "@/db/queries/bookings";
import { getCurrentUser } from "@/lib/auth/session";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

const claimSchema = z.object({
  serviceDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1, "Hãy chọn ít nhất một ngày.")
    .max(62, "Quá nhiều ngày một lúc — hãy thanh toán từng tháng."),
  note: z.string().trim().max(200).optional(),
});

/**
 * "I transferred the money." Creates one pending payment row per date, all
 * sharing a `claimId` so the admin can confirm the whole transfer at once.
 *
 * The amount is recomputed here from the user's bookings — whatever total the
 * page displayed is never trusted.
 */
export async function claimPayment(
  input: unknown,
): Promise<ActionResult<{ claimId: string; totalVnd: number }>> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");

    const { serviceDates, note } = claimSchema.parse(input);
    const uniqueDates = [...new Set(serviceDates)];

    const totals = await getUserTotalsForDates(user.id, uniqueDates);

    const existing = await db
      .select({ serviceDate: payments.serviceDate, status: payments.status })
      .from(payments)
      .where(
        and(eq(payments.userId, user.id), inArray(payments.serviceDate, uniqueDates)),
      );

    const blocked = existing.filter(
      (row) => row.status === "pending" || row.status === "confirmed",
    );
    if (blocked.length > 0) {
      fail(
        `You have already submitted ${blocked.length === 1 ? "that day" : "some of those days"}. Refresh the page.`,
      );
    }

    const claimable = uniqueDates.filter((date) => (totals.get(date) ?? 0) > 0);
    if (claimable.length === 0) fail("Những ngày bạn chọn không còn khoản nào phải trả.");

    const claimId = randomUUID();
    const now = new Date();

    await db
      .insert(payments)
      .values(
        claimable.map((serviceDate) => ({
          userId: user.id,
          serviceDate,
          amountVnd: totals.get(serviceDate)!,
          status: "pending" as const,
          claimId,
          claimedAt: now,
          note: note || null,
          // A previously rejected day is being re-claimed: clear the old verdict.
          confirmedAt: null,
          confirmedByUserId: null,
        })),
      )
      .onConflictDoUpdate({
        target: [payments.userId, payments.serviceDate],
        set: {
          // Take the freshly computed amount from the row we tried to insert,
          // not the stale one on the rejected row we are replacing.
          amountVnd: sql`excluded.amount_vnd`,
          status: "pending",
          claimId,
          claimedAt: now,
          note: note || null,
          confirmedAt: null,
          confirmedByUserId: null,
        },
      });

    const totalVnd = claimable.reduce((total, date) => total + (totals.get(date) ?? 0), 0);

    revalidatePath("/me/payments");
    revalidatePath("/admin/payments");
    revalidatePath("/");
    return actionOk({ claimId, totalVnd });
  } catch (cause) {
    return toActionError(cause, "Không gửi được thông báo thanh toán.");
  }
}

/** Withdraw a pending claim, e.g. the transfer failed. */
export async function withdrawClaim(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");

    const { claimId } = z.object({ claimId: z.string().uuid() }).parse(input);

    const deleted = await db
      .delete(payments)
      .where(
        and(
          eq(payments.claimId, claimId),
          eq(payments.userId, user.id),
          eq(payments.status, "pending"),
        ),
      )
      .returning({ id: payments.id });

    if (deleted.length === 0) fail("Yêu cầu này đã được duyệt rồi.");

    revalidatePath("/me/payments");
    revalidatePath("/admin/payments");
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không thu hồi được yêu cầu.");
  }
}
