"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  adminDiscounts,
  appSettings,
  bookings,
  dayOrders,
  emailImages,
  luckyEnvelopes,
  payments,
  users,
} from "@/db/schema";
import { SETTINGS_ID } from "@/db/queries/settings";
import { RESET_CONFIRM_PHRASE } from "@/lib/admin-reset";
import { getCurrentUser } from "@/lib/auth/session";
import { birthdayField } from "@/lib/birthday";
import { isServiceDate, serviceDateRange, type ServiceDate } from "@/lib/date";
import { ADMIN_DISCOUNT_MAX_DAYS, ADMIN_DISCOUNT_NOTE_MAX } from "@/lib/admin-discount";
import { MAX_DISCOUNT_PERCENT } from "@/lib/day-discount";
import { sniffImageType } from "@/lib/image-type";
import { displayNameField } from "@/lib/display-name";
import { EMAIL_IMAGE_MAX_BYTES } from "@/lib/email/limits";
import { GREETING_MAX_LENGTH } from "@/lib/greeting";
import { HOME_THEME_SETTINGS } from "@/lib/home-themes";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";
import { serverEnv } from "@/env";

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

/** How big a QR photo may be. A QR photo is small. */
const MAX_IMAGE_BYTES = 1_000_000;

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
    // A QR has no business being animated.
    if (!sniffed || sniffed === "image/gif") fail("Chỉ nhận ảnh PNG, JPG hoặc WEBP.");

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

const homeThemeSchema = z.object({
  homeTheme: z.enum(HOME_THEME_SETTINGS),
});

/** Switches the seasonal backdrop on the diner pages, or turns it off. */
export async function updateHomeTheme(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { homeTheme } = homeThemeSchema.parse(input);

    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, homeTheme, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { homeTheme, updatedAt: new Date() },
      });

    // Every page that draws the backdrop — see <SeasonalBackdrop />.
    revalidatePath("/");
    revalidatePath("/me/bookings");
    revalidatePath("/me/payments");
    revalidatePath("/admin/settings");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: "Giao diện này không tồn tại." };
    }
    return toActionError(cause, "Không đổi được giao diện.");
  }
}

const greetingSchema = z.object({
  greetingMessage: z
    .string()
    .trim()
    .max(GREETING_MAX_LENGTH, `Lời chúc tối đa ${GREETING_MAX_LENGTH} ký tự.`),
});

/** Sets the home-page wish; an empty string takes the banner down. */
export async function updateGreeting(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { greetingMessage } = greetingSchema.parse(input);

    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, greetingMessage, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { greetingMessage, updatedAt: new Date() },
      });

    revalidatePath("/");
    revalidatePath("/admin/settings");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Lời chúc không hợp lệ." };
    }
    return toActionError(cause, "Không lưu được lời chúc.");
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
const renameMemberSchema = z.object({
  userId: z.string().uuid(),
  displayName: displayNameField,
});

/**
 * Renames somebody else — for the colleague who never set a name, or the one
 * showing up as an email prefix on the kitchen list.
 *
 * Same column and same rules as the diner's own `/me/profile`, so whoever edits
 * last wins and neither side can write a name the other could not.
 */
export async function renameMember(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { userId, displayName } = renameMemberSchema.parse(input);

    const [updated] = await db
      .update(users)
      .set({ displayName })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (!updated) fail("Không tìm thấy người này.");

    // Their name appears on the home greeting, both admin lists and the roster.
    revalidatePath("/", "layout");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Tên hiển thị không hợp lệ." };
    }
    return toActionError(cause, "Không đổi được tên của người này.");
  }
}

const memberBirthdaySchema = z.object({
  userId: z.string().uuid(),
  // Null clears it, which also lets the person set it themselves again.
  birthday: birthdayField.nullable(),
});

/**
 * Sets, corrects or clears somebody's birthday. A diner may only set their own
 * once (`setOwnBirthday`), so this is where a mistake gets fixed.
 *
 * A day already claimed keeps the amount on its payments row; only unpaid days
 * are re-priced by a change here.
 */
export async function setMemberBirthday(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { userId, birthday } = memberBirthdaySchema.parse(input);

    const [updated] = await db
      .update(users)
      .set({ birthMonth: birthday?.month ?? null, birthDay: birthday?.day ?? null })
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (!updated) fail("Không tìm thấy người này.");

    // Their totals move on every page that shows money.
    revalidatePath("/", "layout");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Ngày sinh không hợp lệ." };
    }
    return toActionError(cause, "Không lưu được ngày sinh.");
  }
}

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
    // The days any lì xì or admin discount took money off are gone with them.
    await db.delete(luckyEnvelopes);
    await db.delete(adminDiscounts);

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

/** Every page an envelope's discount or its overlay shows on. */
function revalidateLuckyEnvelopePages() {
  revalidatePath("/");
  revalidatePath("/me/bookings");
  revalidatePath("/me/payments");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/settings");
}

const luckyEnvelopeSchema = z.object({ enabled: z.boolean() });

/**
 * Turns the lì xì may mắn on or off — the switch and nothing else. Envelopes
 * already opened are kept either way: off only hides the envelope from anyone
 * who has not opened theirs, the discounts already won still count, and on
 * again resumes the same round. Starting a new round is `resetLuckyEnvelopes`.
 */
export async function setLuckyEnvelopeEnabled(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { enabled } = luckyEnvelopeSchema.parse(input);

    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, luckyEnvelopeEnabled: enabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { luckyEnvelopeEnabled: enabled, updatedAt: new Date() },
      });

    revalidateLuckyEnvelopePages();
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không đổi được lì xì.");
  }
}

/**
 * Starts a new round: every envelope is deleted, so everyone gets a fresh one
 * (once the feature is on). The only thing that wipes them — discounts on
 * unpaid days are taken back; a claimed day keeps the amount on its payments
 * row.
 */
export async function resetLuckyEnvelopes(): Promise<ActionResult<number>> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const removed = await db.delete(luckyEnvelopes).returning({ id: luckyEnvelopes.id });

    revalidateLuckyEnvelopePages();
    return actionOk(removed.length);
  } catch (cause) {
    return toActionError(cause, "Không đặt lại được lì xì.");
  }
}

const gymPromoSchema = z.object({
  target: z.enum(["dialog", "banner"]),
  enabled: z.boolean(),
});

/**
 * Turns one Gym Time promo on or off: the dialog shown after sign-in, or the
 * banner on the home page.
 */
export async function setGymPromoEnabled(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    // Not this deployment's to promote — see serverEnv.gymTimeUrl.
    if (!serverEnv.gymTimeUrl) fail("Gym Time không có trên hệ thống này.");

    const { target, enabled } = gymPromoSchema.parse(input);
    const change = {
      ...(target === "dialog" ? { gymPromoEnabled: enabled } : { gymBannerEnabled: enabled }),
      updatedAt: new Date(),
    };

    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, ...change })
      .onConflictDoUpdate({ target: appSettings.id, set: change });

    // The dialog is rendered by the (app) layout, so every page under it; the
    // banner by the home page, which that covers too.
    revalidatePath("/", "layout");
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không đổi được cài đặt Gym Time.");
  }
}

const BANNER_COLUMN = {
  header: "headerBannerImageId",
  billing: "billingBannerImageId",
  footer: "footerBannerImageId",
} as const;
const bannerSlot = z.enum(["header", "billing", "footer"]);

/**
 * Uploads (or replaces) one email banner. Banners are this deployment's own
 * branding, so they live in the database, never in the repository. The
 * picture it replaces is kept: emails already sent were rendered with it,
 * and their job pages still preview it.
 */
export async function setEmailBanner(formData: FormData): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const slot = bannerSlot.parse(formData.get("slot"));
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) fail("Hãy chọn một ảnh.");
    if (file.size > EMAIL_IMAGE_MAX_BYTES) fail("Ảnh quá lớn — tối đa 2 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = sniffImageType(bytes);
    if (!type) fail("Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.");

    const [image] = await db
      .insert(emailImages)
      .values({ data: Buffer.from(bytes).toString("base64"), type, createdByUserId: user.id })
      .returning({ id: emailImages.id });
    const change = { [BANNER_COLUMN[slot]]: image.id, updatedAt: new Date() };
    await db
      .insert(appSettings)
      .values({ id: SETTINGS_ID, ...change })
      .onConflictDoUpdate({ target: appSettings.id, set: change });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/emails", "layout");
    return actionOk();
  } catch (cause) {
    if (cause instanceof z.ZodError) return { ok: false, error: "Vị trí banner không hợp lệ." };
    return toActionError(cause, "Không tải được banner lên.");
  }
}

/** Takes one banner off every email from now on. */
export async function removeEmailBanner(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { slot } = z.object({ slot: bannerSlot }).parse(input);
    await db
      .update(appSettings)
      .set({ [BANNER_COLUMN[slot]]: null, updatedAt: new Date() })
      .where(eq(appSettings.id, SETTINGS_ID));

    revalidatePath("/admin/settings");
    revalidatePath("/admin/emails", "layout");
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không gỡ được banner.");
  }
}

/** Every page a discount changes an amount on. */
function revalidateMoneyPages() {
  revalidatePath("/");
  revalidatePath("/me/bookings");
  revalidatePath("/me/payments");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/settings");
}

const serviceDateField = z.string().refine(isServiceDate, "Ngày không hợp lệ.");

const adminDiscountSchema = z
  .object({
    userId: z.string().uuid("Hãy chọn một người."),
    from: serviceDateField,
    to: serviceDateField,
    percent: z
      .number()
      .int("Phần trăm phải là số nguyên.")
      .min(1, "Giảm ít nhất 1%.")
      .max(MAX_DISCOUNT_PERCENT, `Giảm nhiều nhất ${MAX_DISCOUNT_PERCENT}%.`),
    note: z
      .string()
      .trim()
      .max(ADMIN_DISCOUNT_NOTE_MAX, `Ghi chú tối đa ${ADMIN_DISCOUNT_NOTE_MAX} ký tự.`)
      .transform((note) => note || null),
  })
  .refine((v) => v.from <= v.to, { message: "Ngày kết thúc phải sau ngày bắt đầu." });

/** Dates in `dates` this person has already claimed — their amount is fixed. */
async function claimedDates(userId: string, dates: ServiceDate[]): Promise<Set<ServiceDate>> {
  if (dates.length === 0) return new Set();
  const rows = await db
    .select({ serviceDate: payments.serviceDate })
    .from(payments)
    .where(
      and(
        eq(payments.userId, userId),
        inArray(payments.serviceDate, dates),
        inArray(payments.status, ["pending", "confirmed"]),
      ),
    );
  return new Set(rows.map((row) => row.serviceDate));
}

export type SetAdminDiscountResult = { saved: number; skipped: ServiceDate[] };

/**
 * Gives one person a percentage off one date or every date in a range. Setting
 * a date again replaces its discount. Days they already claimed are skipped,
 * not refused as a whole: their amount is fixed on the payments row, and a
 * range should still land on the days it can.
 */
export async function setAdminDiscount(
  input: unknown,
): Promise<ActionResult<SetAdminDiscountResult>> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { userId, from, to, percent, note } = adminDiscountSchema.parse(input);
    const dates = serviceDateRange(from, to, ADMIN_DISCOUNT_MAX_DAYS + 1);
    if (dates.length > ADMIN_DISCOUNT_MAX_DAYS) {
      fail(`Mỗi lần chỉ đặt được tối đa ${ADMIN_DISCOUNT_MAX_DAYS} ngày.`);
    }

    const [member] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!member) fail("Không tìm thấy người này.");

    const claimed = await claimedDates(userId, dates);
    const open = dates.filter((date) => !claimed.has(date));
    if (open.length === 0) {
      fail(
        dates.length === 1
          ? "Người này đã thanh toán ngày đó — số tiền không đổi được nữa."
          : "Người này đã thanh toán tất cả các ngày đó — số tiền không đổi được nữa.",
      );
    }

    await db
      .insert(adminDiscounts)
      .values(open.map((serviceDate) => ({ userId, serviceDate, percent, note })))
      .onConflictDoUpdate({
        target: [adminDiscounts.userId, adminDiscounts.serviceDate],
        set: { percent, note, createdAt: new Date() },
      });

    revalidateMoneyPages();
    return actionOk({ saved: open.length, skipped: [...claimed].sort() });
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Thông tin giảm giá chưa đúng." };
    }
    return toActionError(cause, "Không lưu được giảm giá.");
  }
}

/**
 * Takes one admin discount back. Refused on a claimed day for the same reason
 * setting one is: the amount on its payments row would no longer match.
 */
export async function removeAdminDiscount(input: unknown): Promise<ActionResult> {
  try {
    const user = await getCurrentUser();
    if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
    if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");

    const { id } = z.object({ id: z.string().uuid() }).parse(input);

    const [row] = await db
      .select({ userId: adminDiscounts.userId, serviceDate: adminDiscounts.serviceDate })
      .from(adminDiscounts)
      .where(eq(adminDiscounts.id, id))
      .limit(1);
    if (!row) fail("Giảm giá này không còn nữa.");

    const claimed = await claimedDates(row.userId, [row.serviceDate]);
    if (claimed.size > 0) fail("Người này đã thanh toán ngày đó — số tiền không đổi được nữa.");

    await db.delete(adminDiscounts).where(eq(adminDiscounts.id, id));

    revalidateMoneyPages();
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không xoá được giảm giá.");
  }
}
