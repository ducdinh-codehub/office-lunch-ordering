"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { bookings, menuDays, menuItems, SET_CATEGORIES } from "@/db/schema";
import {
  clearShipDinerCount,
  freezeShipDinerCount,
  resyncDayOrders,
} from "@/db/queries/bookings";
import { getCurrentUser } from "@/lib/auth/session";
import { localInputToInstant } from "@/lib/date";
import { actionOk, fail, toActionError, type ActionResult } from "@/lib/action-result";
import { parseMenuText } from "@/lib/menu-import";

async function assertAdmin() {
  const user = await getCurrentUser();
  if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
  if (!user.isAdmin) fail("Bạn không có quyền thực hiện thao tác này.");
  return user;
}

function revalidateMenu(serviceDate: string) {
  revalidatePath("/");
  revalidatePath("/admin/menu");
  revalidatePath(`/menu/${serviceDate}`);
  revalidatePath(`/admin/bookings/${serviceDate}`);
}

const serviceDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ.");

const categorySchema = z.enum(["main", "side", "veg", "addon", "drink"]);

/** Set dishes are covered by the set price, so they never carry one of their own. */
function priceForCategory(category: z.infer<typeof categorySchema>, priceVnd: number) {
  return (SET_CATEGORIES as readonly string[]).includes(category) ? 0 : priceVnd;
}

/* ─────────────────────────────── the day itself ──────────────────────────── */

const upsertDaySchema = z.object({
  serviceDate: serviceDateSchema,
  status: z.enum(["draft", "open", "locked"]),
  // `datetime-local` value in Vietnam time, or "" for no cutoff.
  orderCutoff: z.string().max(32).optional(),
  note: z.string().trim().max(500).optional(),
  setPriceVnd: z.number().int().min(0).max(100_000_000),
  requiredMain: z.number().int().min(0).max(10),
  requiredSide: z.number().int().min(0).max(10),
  requiredVeg: z.number().int().min(0).max(10),
  shipFeeVnd: z.number().int().min(0).max(100_000_000),
});

export async function upsertMenuDay(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin();
    const {
      serviceDate,
      status,
      orderCutoff,
      note,
      setPriceVnd,
      requiredMain,
      requiredSide,
      requiredVeg,
      shipFeeVnd,
    } = upsertDaySchema.parse(input);

    const cutoff = orderCutoff ? localInputToInstant(orderCutoff) : null;
    if (cutoff && Number.isNaN(cutoff.getTime())) fail("Thời gian chốt đơn không hợp lệ.");

    const dayValues = {
      status,
      orderCutoff: cutoff,
      note: note || null,
      setPriceVnd,
      requiredMain,
      requiredSide,
      requiredVeg,
      shipFeeVnd,
    };

    const [day] = await db
      .insert(menuDays)
      .values({ serviceDate, ...dayValues })
      .onConflictDoUpdate({ target: menuDays.serviceDate, set: dayValues })
      .returning({ id: menuDays.id });

    // Changing the required counts can complete or un-complete sets that people
    // already picked, so re-evaluate every diner for this day.
    await resyncDayOrders(day.id);

    // Locking is the moment the order goes to the quán, so it is also the moment
    // each person's slice of the ship fee stops moving. Re-opening a day hands it
    // back to the live split.
    if (status === "locked") await freezeShipDinerCount(day.id);
    else await clearShipDinerCount(day.id);

    revalidateMenu(serviceDate);
    return actionOk({ id: day.id });
  } catch (cause) {
    return toActionError(cause, "Không lưu được ngày này.");
  }
}

/* ─────────────────────────────────── items ───────────────────────────────── */

const itemSchema = z.object({
  serviceDate: serviceDateSchema,
  name: z.string().trim().min(1, "Hãy đặt tên cho món ăn.").max(120),
  description: z.string().trim().max(300).optional(),
  priceVnd: z.number().int().min(0).max(100_000_000),
  category: categorySchema,
});

export async function addMenuItem(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { serviceDate, name, description, priceVnd, category } = itemSchema.parse(input);

    // Create the day on the fly so adding the first dish is a single step.
    const [day] = await db
      .insert(menuDays)
      .values({ serviceDate, status: "draft" })
      .onConflictDoUpdate({ target: menuDays.serviceDate, set: { serviceDate } })
      .returning({ id: menuDays.id });

    // Append to the end of the list.
    const [{ maxSort }] = await db
      .select({ maxSort: sql<number>`coalesce(max(${menuItems.sortOrder}), -1)::int` })
      .from(menuItems)
      .where(eq(menuItems.menuDayId, day.id));

    await db.insert(menuItems).values({
      menuDayId: day.id,
      name,
      description: description || null,
      category,
      priceVnd: priceForCategory(category, priceVnd),
      sortOrder: Number(maxSort) + 1,
    });

    revalidateMenu(serviceDate);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không thêm được món.");
  }
}

const updateItemSchema = z.object({
  menuItemId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional(),
  priceVnd: z.number().int().min(0).max(100_000_000),
  category: categorySchema,
  isAvailable: z.boolean(),
});

export async function updateMenuItem(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { menuItemId, name, description, priceVnd, category, isAvailable } =
      updateItemSchema.parse(input);

    const [updated] = await db
      .update(menuItems)
      .set({
        name,
        description: description || null,
        category,
        priceVnd: priceForCategory(category, priceVnd),
        isAvailable,
      })
      .where(eq(menuItems.id, menuItemId))
      .returning({ menuDayId: menuItems.menuDayId });

    if (!updated) fail("Món này không còn tồn tại.");

    // Moving a dish between categories changes what each diner has picked.
    await resyncDayOrders(updated.menuDayId);

    const day = await db.query.menuDays.findFirst({
      where: eq(menuDays.id, updated.menuDayId),
      columns: { serviceDate: true },
    });
    if (day) revalidateMenu(day.serviceDate);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không cập nhật được món.");
  }
}

export async function deleteMenuItem(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
    const { menuItemId } = z.object({ menuItemId: z.string().uuid() }).parse(input);

    const existingBookings = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.menuItemId, menuItemId), eq(bookings.status, "booked")))
      .limit(1);

    if (existingBookings.length > 0) {
      fail("Đã có người đặt món này. Hãy đánh dấu hết món thay vì xoá.");
    }

    const [deleted] = await db
      .delete(menuItems)
      .where(eq(menuItems.id, menuItemId))
      .returning({ menuDayId: menuItems.menuDayId });

    if (!deleted) fail("Món này không còn tồn tại.");

    await resyncDayOrders(deleted.menuDayId);

    const day = await db.query.menuDays.findFirst({
      where: eq(menuDays.id, deleted.menuDayId),
      columns: { serviceDate: true },
    });
    if (day) revalidateMenu(day.serviceDate);
    return actionOk();
  } catch (cause) {
    return toActionError(cause, "Không xoá được món.");
  }
}

/* ────────────────────────────────── copying ──────────────────────────────── */

/** Copies the dishes from the most recent earlier day that has any. */
export async function copyPreviousMenu(input: unknown): Promise<ActionResult<{ copied: number }>> {
  try {
    await assertAdmin();
    const { serviceDate } = z.object({ serviceDate: serviceDateSchema }).parse(input);

    const source = await db.query.menuDays.findFirst({
      where: lt(menuDays.serviceDate, serviceDate),
      orderBy: (days, { desc }) => [desc(days.serviceDate)],
      with: { items: { orderBy: [asc(menuItems.sortOrder)] } },
    });

    if (!source || source.items.length === 0) {
      fail("Không có thực đơn trước đó để sao chép.");
    }

    // Carry the set configuration across as well — copying yesterday's dishes but
    // leaving the suất at 0 ₫ would silently publish a free day.
    const setConfig = {
      setPriceVnd: source.setPriceVnd,
      requiredMain: source.requiredMain,
      requiredSide: source.requiredSide,
      requiredVeg: source.requiredVeg,
      shipFeeVnd: source.shipFeeVnd,
    };

    const [target] = await db
      .insert(menuDays)
      .values({ serviceDate, status: "draft", ...setConfig })
      .onConflictDoUpdate({ target: menuDays.serviceDate, set: setConfig })
      .returning({ id: menuDays.id });

    const existing = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(eq(menuItems.menuDayId, target.id))
      .limit(1);

    if (existing.length > 0) fail("Ngày này đã có món — hãy xoá hết trước.");

    await db.insert(menuItems).values(
      source.items.map((item, index) => ({
        menuDayId: target.id,
        name: item.name,
        description: item.description,
        category: item.category,
        priceVnd: item.priceVnd,
        isAvailable: true,
        sortOrder: index,
      })),
    );

    revalidateMenu(serviceDate);
    return actionOk({ copied: source.items.length });
  } catch (cause) {
    return toActionError(cause, "Không sao chép được thực đơn trước.");
  }
}

/* ────────────────────────────────── import ───────────────────────────────── */

const importSchema = z.object({
  serviceDate: serviceDateSchema,
  text: z.string().trim().min(1, "Hãy dán thực đơn vào ô bên trên.").max(20_000),
});

/**
 * Builds a day's menu from the restaurant's Zalo message.
 *
 * Replaces whatever the day already has — importing is how you set the day up,
 * not how you patch it — so it refuses once anyone has booked, rather than
 * cascade-deleting their picks along with the dishes.
 */
export async function importMenuText(
  input: unknown,
): Promise<ActionResult<{ imported: number; missingPrice: number }>> {
  try {
    await assertAdmin();
    const { serviceDate, text } = importSchema.parse(input);

    const parsed = parseMenuText(text);
    if (parsed.items.length === 0) {
      fail("Không nhận ra món nào. Thực đơn cần có các mục Món chính, Món phụ, Món rau…");
    }

    const [day] = await db
      .insert(menuDays)
      .values({ serviceDate, status: "draft" })
      .onConflictDoUpdate({ target: menuDays.serviceDate, set: { serviceDate } })
      .returning({ id: menuDays.id });

    const booked = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.menuDayId, day.id), eq(bookings.status, "booked")))
      .limit(1);

    if (booked.length > 0) {
      fail("Đã có người đặt món cho ngày này — không thể nhập đè thực đơn.");
    }

    await db.delete(menuItems).where(eq(menuItems.menuDayId, day.id));
    await db.insert(menuItems).values(
      parsed.items.map((item, index) => ({
        menuDayId: day.id,
        name: item.name,
        description: item.description,
        category: item.category,
        priceVnd: priceForCategory(item.category, item.priceVnd),
        isAvailable: true,
        sortOrder: index,
      })),
    );

    revalidateMenu(serviceDate);
    return actionOk({ imported: parsed.items.length, missingPrice: parsed.missingPrice });
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      return { ok: false, error: cause.issues[0]?.message ?? "Không đọc được thực đơn." };
    }
    return toActionError(cause, "Không nhập được thực đơn.");
  }
}
