"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { birthdayField } from "@/lib/birthday";
import { displayNameField } from "@/lib/display-name";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

// Empty means "go back to the default" — see `displayNameField`.
const displayNameSchema = z.object({ displayName: displayNameField });

/**
 * Renames the signed-in user, and only ever them — the row is chosen by the
 * session, never by an id from the client, so there is nothing to tamper with.
 *
 * The name lives in our own `users` row rather than in Clerk: Clerk owns
 * identity, this app owns everything the group sees. The two drift apart after
 * an edit here, which is fine — nothing reads the Clerk name again once the row
 * exists.
 */
export async function updateDisplayName(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { displayName } = displayNameSchema.parse(input);

    await db.update(users).set({ displayName }).where(eq(users.id, user.id));

    // The name shows on the home greeting, both admin lists and the payment
    // roster, so the whole tree is stale rather than one page of it.
    revalidatePath("/", "layout");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Tên hiển thị không hợp lệ." };
    }
    return toActionError(cause, "Không đổi được tên hiển thị.");
  }
}

const birthdaySchema = z.object({ birthday: birthdayField });

/**
 * Sets the signed-in user's birthday — once. The birthday takes 10% off that
 * day's bill, so a birthday you could move at will would be a discount you
 * could claim at will: after the first save only the admin can change it.
 *
 * "Once" is the `birth_month is null` in the update itself, not a read before
 * it, so two saves racing each other cannot both land.
 */
export async function setOwnBirthday(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { birthday } = birthdaySchema.parse(input);

    const [updated] = await db
      .update(users)
      .set({ birthMonth: birthday.month, birthDay: birthday.day })
      .where(and(eq(users.id, user.id), isNull(users.birthMonth)))
      .returning({ id: users.id });

    if (!updated) fail("Bạn đã lưu ngày sinh rồi. Nhờ quản lý sửa nếu bị nhầm.");

    // Today's bill may have just become a birthday one.
    revalidatePath("/", "layout");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Ngày sinh không hợp lệ." };
    }
    return toActionError(cause, "Không lưu được ngày sinh.");
  }
}
