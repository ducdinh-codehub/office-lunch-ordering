import "server-only";

import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { menuDays, menuItems, type MenuDay, type MenuItem } from "@/db/schema";
import type { ServiceDate } from "@/lib/date";

export type MenuDayWithItems = MenuDay & { items: MenuItem[] };

export async function getMenuDay(serviceDate: ServiceDate): Promise<MenuDayWithItems | null> {
  const day = await db.query.menuDays.findFirst({
    where: eq(menuDays.serviceDate, serviceDate),
    with: { items: { orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)] } },
  });
  return day ?? null;
}

/** Days a user is allowed to see and book: open or locked, never draft. */
export async function getPublishedMenuDays(
  from: ServiceDate,
  to: ServiceDate,
): Promise<MenuDayWithItems[]> {
  return db.query.menuDays.findMany({
    where: and(
      gte(menuDays.serviceDate, from),
      lte(menuDays.serviceDate, to),
      inArray(menuDays.status, ["open", "locked"]),
    ),
    with: { items: { orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)] } },
    orderBy: [asc(menuDays.serviceDate)],
  });
}

/** All days including drafts — admin only. */
export async function getAllMenuDays(limit = 60): Promise<MenuDay[]> {
  return db.query.menuDays.findMany({
    orderBy: [desc(menuDays.serviceDate)],
    limit,
  });
}

/** True while users may still book or cancel for this day. */
export function isBookingOpen(day: Pick<MenuDay, "status" | "orderCutoff">): boolean {
  if (day.status !== "open") return false;
  if (day.orderCutoff && new Date() > new Date(day.orderCutoff)) return false;
  return true;
}

export function bookingClosedReason(
  day: Pick<MenuDay, "status" | "orderCutoff"> | null,
): string | null {
  if (!day) return "Chưa có thực đơn cho ngày này.";
  if (day.status === "draft") return "Thực đơn này chưa được đăng.";
  if (day.status === "locked") return "Ngày này đã chốt — đơn đã gửi cho quán.";
  if (day.orderCutoff && new Date() > new Date(day.orderCutoff)) {
    return "Đã quá hạn đặt món cho ngày này.";
  }
  return null;
}
