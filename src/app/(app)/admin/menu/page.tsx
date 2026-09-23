import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ClipboardList } from "lucide-react";

import { MenuEditor } from "@/components/admin/menu-editor";
import { DeleteMenuDay } from "@/components/admin/delete-menu-day";
import { SlotTabs, type SlotTab } from "@/components/menu/slot-tabs";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getAllMenuDays, getMenuDay, getMenuDaysForDate } from "@/db/queries/menu";
import { getAppSettings } from "@/db/queries/settings";
import {
  DEFAULT_SLOT,
  MENU_SLOTS,
  SLOT_LABEL,
  parseMenuSlot,
  withSlot,
} from "@/lib/menu-slot";
import {
  formatInstant,
  formatServiceDate,
  formatServiceDateShort,
  instantToLocalInput,
  isServiceDate,
  shiftServiceDate,
  todayServiceDate,
} from "@/lib/date";

export const dynamic = "force-dynamic";

const statusVariant = {
  draft: "secondary",
  open: "default",
  locked: "outline",
} as const;

const statusLabel = {
  draft: "nháp",
  open: "đang mở",
  locked: "đã chốt",
} as const;

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; buoi?: string }>;
}) {
  const { date, buoi } = await searchParams;
  const today = todayServiceDate();

  if (date && !isServiceDate(date)) redirect("/admin/menu");
  const serviceDate = date ?? today;
  const slot = parseMenuSlot(buoi);

  const [day, existingDays, recentDays, settings] = await Promise.all([
    getMenuDay(serviceDate, slot),
    getMenuDaysForDate(serviceDate),
    getAllMenuDays(14),
    getAppSettings(),
  ]);

  // The admin always sees both tabs — the afternoon one is how a party menu
  // gets created in the first place, so it has to be reachable before it
  // exists. `exists` is what labels it as not made yet.
  // The other sitting's deadline, so the form can state the ordering rule up
  // front instead of letting the admin discover it by being refused.
  const sibling = existingDays.find((existing) => existing.slot !== slot);
  const siblingCutoffLabel = sibling?.orderCutoff
    ? formatInstant(sibling.orderCutoff)
    : null;

  const tabs: SlotTab[] = MENU_SLOTS.map((candidate) => ({
    slot: candidate,
    href: withSlot(`/admin/menu?date=${serviceDate}`, candidate),
    exists: existingDays.some((existing) => existing.slot === candidate),
  }));

  // Which dishes already have bookings — those can be sold out but not deleted.
  const itemIds = day?.items.map((item) => item.id) ?? [];
  const bookedItemIds =
    itemIds.length > 0
      ? await db
          .selectDistinct({ menuItemId: bookings.menuItemId })
          .from(bookings)
          .where(and(inArray(bookings.menuItemId, itemIds), eq(bookings.status, "booked")))
          .then((rows) => rows.map((row) => row.menuItemId))
      : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Thực đơn
            {slot !== DEFAULT_SLOT && (
              <span className="text-muted-foreground ml-2 text-base font-normal">
                {SLOT_LABEL[slot]}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm">{formatServiceDate(serviceDate)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {slot !== DEFAULT_SLOT && day && (
            <DeleteMenuDay serviceDate={serviceDate} slot={slot} />
          )}
          <LinkButton
            href={withSlot(`/admin/bookings/${serviceDate}`, slot)}
            variant="outline"
            size="sm"
          >
            <ClipboardList className="size-4" />
            Danh sách bếp
          </LinkButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[-1, 0, 1, 2].map((offset) => {
          const target = shiftServiceDate(today, offset);
          const label = offset === 0 ? "Hôm nay" : formatServiceDateShort(target);
          return (
            <LinkButton
              key={target}
              href={withSlot(`/admin/menu?date=${target}`, slot)}
              size="sm"
              variant={target === serviceDate ? "default" : "outline"}
            >
              {label}
            </LinkButton>
          );
        })}
      </div>

      <SlotTabs tabs={tabs} activeSlot={slot} />

      {/* Keyed by date *and* sitting so switching either remounts the form;
          without this the previous menu's status/cutoff/note would linger in
          local state and saving would write it to the one now on screen. */}
      <MenuEditor
        key={`${serviceDate}:${slot}`}
        serviceDate={serviceDate}
        slot={slot}
        siblingCutoffLabel={siblingCutoffLabel}
        status={day?.status ?? "draft"}
        orderCutoffLocal={instantToLocalInput(day?.orderCutoff ?? null)}
        note={day?.note ?? ""}
        setPriceVnd={day?.setPriceVnd ?? 0}
        shipFeeVnd={day?.shipFeeVnd ?? settings.defaultShipFeeVnd}
        requiredMain={day?.requiredMain ?? 2}
        requiredSide={day?.requiredSide ?? 1}
        requiredVeg={day?.requiredVeg ?? 1}
        altSetPriceVnd={day?.altSetPriceVnd ?? 0}
        altRequiredMain={day?.altRequiredMain ?? 0}
        altRequiredSide={day?.altRequiredSide ?? 0}
        altRequiredVeg={day?.altRequiredVeg ?? 0}
        items={day?.items ?? []}
        bookedItemIds={bookedItemIds}
      />

      {recentDays.length > 0 && (
        <div>
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">Những ngày gần đây</h2>
          <div className="flex flex-wrap gap-1.5">
            {recentDays.map((recent) => (
              <Link
                key={recent.id}
                href={withSlot(`/admin/menu?date=${recent.serviceDate}`, recent.slot)}
              >
                <Badge
                  variant={statusVariant[recent.status]}
                  className="cursor-pointer gap-1.5 py-1"
                >
                  {formatServiceDateShort(recent.serviceDate)}
                  {recent.slot !== DEFAULT_SLOT && (
                    <span className="opacity-60">{SLOT_LABEL[recent.slot].toLowerCase()}</span>
                  )}
                  <span className="opacity-60">{statusLabel[recent.status]}</span>
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
