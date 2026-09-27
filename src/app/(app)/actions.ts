"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { luckyEnvelopes, payments } from "@/db/schema";
import { getAppSettings } from "@/db/queries/settings";
import { requireUser } from "@/lib/auth/session";
import { todayServiceDate, type ServiceDate } from "@/lib/date";
import { drawLuckyPercent, type LuckyPercent } from "@/lib/lucky-envelope";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

export type OpenedEnvelope = { percent: LuckyPercent; serviceDate: ServiceDate };

/**
 * Opens this person's lì xì: draws the prize on the server and records it
 * against today. Once per person per round — the unique `user_id` enforces it,
 * so a double tap opens one envelope and the second is told so.
 *
 * Refused when today is already claimed or paid: that day's amount is fixed on
 * its payments row, so a discount landing now could not be honoured. They can
 * open it another day instead.
 */
export async function openLuckyEnvelope(): Promise<ActionResult<OpenedEnvelope>> {
  try {
    const user = await requireUser();

    const settings = await getAppSettings();
    if (!settings.luckyEnvelopeEnabled) fail("Lì xì đã hết đợt rồi.");

    const serviceDate = todayServiceDate();
    const [paidToday] = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, user.id),
          eq(payments.serviceDate, serviceDate),
          inArray(payments.status, ["pending", "confirmed"]),
        ),
      )
      .limit(1);
    if (paidToday) fail("Hôm nay bạn đã thanh toán rồi — hãy mở lì xì vào hôm khác nhé.");

    const percent = drawLuckyPercent(randomInt(100));
    const [opened] = await db
      .insert(luckyEnvelopes)
      .values({ userId: user.id, serviceDate, percent })
      .onConflictDoNothing({ target: luckyEnvelopes.userId })
      .returning({ percent: luckyEnvelopes.percent });
    if (!opened) fail("Bạn đã mở lì xì rồi.");

    // Every page that shows what they owe.
    revalidatePath("/");
    revalidatePath("/me/bookings");
    revalidatePath("/me/payments");
    revalidatePath("/admin/payments");
    revalidatePath("/admin/settings");
    return actionOk({ percent: opened.percent as LuckyPercent, serviceDate });
  } catch (cause) {
    return toActionError(cause, "Không mở được lì xì.");
  }
}
