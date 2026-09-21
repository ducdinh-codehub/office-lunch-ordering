"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { appSettings, bookings, dayOrders, payments } from "@/db/schema";
import { SETTINGS_ID } from "@/db/queries/settings";
import { RESET_CONFIRM_PHRASE } from "@/lib/admin-reset";
import { getCurrentUser } from "@/lib/auth/session";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";

const settingsSchema = z.object({
  // VietQR bank codes are short alphanumeric identifiers, e.g. "VCB", "970436".
  bankCode: z.string().trim().max(20).regex(/^[A-Za-z0-9]*$/, "Mã ngân hàng không hợp lệ."),
  bankAccountNo: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9]*$/, "Số tài khoản chỉ được chứa chữ số."),
  bankAccountName: z.string().trim().max(100),
  qrTemplate: z.enum(["compact", "compact2", "qr_only", "print"]),
  defaultShipFeeVnd: z.number().int().min(0).max(100_000_000),
});

/** What the browser is allowed to send, and how big. A QR photo is small. */
type AllowedImageType = "image/png" | "image/jpeg" | "image/webp";
const MAX_IMAGE_BYTES = 1_000_000;

/**
 * Magic bytes for each accepted format. The browser's declared MIME type is
 * attacker-controlled, and this image is served back to everyone in the group,
 * so the bytes themselves decide what it is.
 */
function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  const matches = (offset: number, ...signature: number[]) =>
    signature.every((byte, index) => bytes[offset + index] === byte);

  if (matches(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (matches(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  // "RIFF" .... "WEBP"
  if (matches(0, 0x52, 0x49, 0x46, 0x46) && matches(8, 0x57, 0x45, 0x42, 0x50)) {
    return "image/webp";
  }
  return null;
}

/** Stores the admin's own bank QR photo. */
export async function uploadBankQr(formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) fail("Hãy chọn một ảnh mã QR.");
    if (file.size > MAX_IMAGE_BYTES) fail("Ảnh quá lớn — tối đa 1 MB.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageType(bytes);
    if (!sniffed) fail("Chỉ nhận ảnh PNG, JPG hoặc WEBP.");

    const image = {
      qrImageData: Buffer.from(bytes).toString("base64"),
      qrImageType: sniffed,
      updatedAt: new Date(),
    };

    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, ...image })
      .onConflictDoUpdate({ target: appSettings.id, set: image });

    revalidatePath("/admin/settings");
    revalidatePath("/me/payments");
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không tải được ảnh lên.");
  }
}

/** Removes the uploaded QR, handing the payments page back to VietQR. */
export async function removeBankQr(): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    await db
      .update(appSettings)
      .set({ qrImageData: null, qrImageType: null, updatedAt: new Date() })
      .where(eq(appSettings.id, SETTINGS_ID));

    revalidatePath("/admin/settings");
    revalidatePath("/me/payments");
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không xoá được ảnh.");
  }
}

export async function updateAppSettings(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const values = settingsSchema.parse(input);

    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, ...values, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { ...values, updatedAt: new Date() },
      });

    revalidatePath("/admin/settings");
    revalidatePath("/me/payments");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Thông tin nhập vào có vẻ chưa đúng." };
    }
    return toActionError(cause, "Không lưu được cài đặt.");
  }
}

const resetSchema = z.object({
  confirm: z.string(),
});

/**
 * Wipes the order history — bookings, completed sets, and payment records — so
 * a new year starts from zero.
 *
 * Deliberately *not* touched: `users` (people keep their accounts), the menus
 * themselves, and `app_settings`. Deleting a menu day would cascade into the
 * bookings anyway, and the menu library is worth keeping.
 *
 * There is no undo. The typed phrase is the guard.
 */
export async function resetOrderHistory(input: unknown): Promise<ActionResult<number>> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { confirm } = resetSchema.parse(input);
    if (confirm.trim() !== RESET_CONFIRM_PHRASE) {
      fail(`Gõ đúng "${RESET_CONFIRM_PHRASE}" để xác nhận.`);
    }

    // Counted before the delete so the admin gets told what actually went.
    const [{ count: bookingCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings);

    // Three independent deletes: `payments` has no foreign key to the other
    // two, and re-running fixes any half-finished wipe, so they do not need a
    // transaction (which the Neon HTTP driver could not give them anyway).
    await db.delete(payments);
    await db.delete(bookings);
    await db.delete(dayOrders);

    revalidatePath("/");
    revalidatePath("/admin/settings");
    revalidatePath("/admin/payments");
    revalidatePath("/me/bookings");
    revalidatePath("/me/payments");
    return actionOk(bookingCount);
  } catch (cause) {
    return toActionError(cause, "Không xoá được dữ liệu.");
  }
}
