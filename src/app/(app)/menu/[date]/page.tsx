import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MenuDayView } from "@/components/menu/menu-day-view";
import { SlotTabs, type SlotTab } from "@/components/menu/slot-tabs";
import { CloseButton } from "@/components/layout/close-button";
import { getMenuDay, getMenuDaysForDate } from "@/db/queries/menu";
import { requireUser } from "@/lib/auth/session";
import { parseSelectedTier } from "@/lib/set-tiers";
import {
  MENU_SLOTS,
  parseMenuSlotParam,
  resolveActiveSlot,
  withSlot,
} from "@/lib/menu-slot";
import {
  formatServiceDateShort,
  isServiceDate,
  shiftServiceDate,
  todayServiceDate,
} from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function MenuDatePage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ suat?: string; buoi?: string }>;
}) {
  const [{ date }, { suat, buoi }] = await Promise.all([params, searchParams]);
  if (!isServiceDate(date)) notFound();

  const user = await requireUser();
  const allDays = await getMenuDaysForDate(date);

  // An explicit `?buoi=` wins — that is someone asking for a specific sitting,
  // including a locked lunch they want to look back at. With no parameter the
  // date decides for itself, so a locked lunch hands the day to the party.
  const slot = parseMenuSlotParam(buoi) ?? resolveActiveSlot(allDays);
  const day = await getMenuDay(date, slot);

  // Drafts are admin-only; to everyone else the day simply has no menu.
  const visibleDay = day && day.status === "draft" && !user.isAdmin ? null : day;

  // A tab per sitting this date actually sells. Drafts count only for the
  // admin, so nobody else is offered a tab that leads to an empty card. With
  // lunch alone SlotTabs renders nothing.
  const tabs: SlotTab[] = MENU_SLOTS.filter((candidate) =>
    allDays.some(
      (existing) =>
        existing.slot === candidate && (existing.status !== "draft" || user.isAdmin),
    ),
  ).map((candidate) => ({
    slot: candidate,
    href: withSlot(`/menu/${date}`, candidate),
    exists: true,
  }));

  const previous = shiftServiceDate(date, -1);
  const next = shiftServiceDate(date, 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={withSlot(`/menu/${previous}`, slot)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="size-4" />
          {formatServiceDateShort(previous)}
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">
          {date === todayServiceDate() ? "Hôm nay" : "Về hôm nay"}
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href={withSlot(`/menu/${next}`, slot)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            {formatServiceDateShort(next)}
            <ChevronRight className="size-4" />
          </Link>
          {/* Back to the list this day was opened from — usually Đơn của tôi. */}
          <CloseButton fallbackHref="/me/bookings" label="Đóng, quay lại danh sách" />
        </div>
      </div>

      <SlotTabs tabs={tabs} activeSlot={slot} />

      <MenuDayView
        serviceDate={date}
        slot={slot}
        day={visibleDay}
        userId={user.id}
        selectedTier={parseSelectedTier(suat)}
      />
    </div>
  );
}
