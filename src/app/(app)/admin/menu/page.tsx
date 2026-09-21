import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { ClipboardList } from "lucide-react";

import { ImportMenu } from "@/components/admin/import-menu";
import { MenuEditor } from "@/components/admin/menu-editor";
import { LinkButton } from "@/components/ui/link-button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getAllMenuDays, getMenuDay } from "@/db/queries/menu";
import { getAppSettings } from "@/db/queries/settings";
import {
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
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = todayServiceDate();

  if (date && !isServiceDate(date)) redirect("/admin/menu");
  const serviceDate = date ?? today;

  const [day, recentDays, settings] = await Promise.all([
    getMenuDay(serviceDate),
    getAllMenuDays(14),
    getAppSettings(),
  ]);

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
          <h1 className="text-2xl font-semibold tracking-tight">Thực đơn</h1>
          <p className="text-muted-foreground text-sm">{formatServiceDate(serviceDate)}</p>
        </div>
        <LinkButton
          href={`/admin/bookings/${serviceDate}`}
          variant="outline"
          size="sm"
        >
          <ClipboardList className="size-4" />
          Danh sách bếp
        </LinkButton>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[-1, 0, 1, 2].map((offset) => {
          const target = shiftServiceDate(today, offset);
          const label = offset === 0 ? "Hôm nay" : formatServiceDateShort(target);
          return (
            <LinkButton
              key={target}
              href={`/admin/menu?date=${target}`}
              size="sm"
              variant={target === serviceDate ? "default" : "outline"}
            >
              {label}
            </LinkButton>
          );
        })}
      </div>

      {/* Keyed by date for the same reason MenuEditor is: a half-typed paste
          must not follow the admin to another day. */}
      <ImportMenu key={`import-${serviceDate}`} serviceDate={serviceDate} />

      {/* Keyed by date so switching days remounts the form; without this the
          previous day's status/cutoff/note would linger in local state. */}
      <MenuEditor
        key={serviceDate}
        serviceDate={serviceDate}
        status={day?.status ?? "draft"}
        orderCutoffLocal={instantToLocalInput(day?.orderCutoff ?? null)}
        note={day?.note ?? ""}
        setPriceVnd={day?.setPriceVnd ?? 0}
        shipFeeVnd={day?.shipFeeVnd ?? settings.defaultShipFeeVnd}
        requiredMain={day?.requiredMain ?? 2}
        requiredSide={day?.requiredSide ?? 1}
        requiredVeg={day?.requiredVeg ?? 1}
        items={day?.items ?? []}
        bookedItemIds={bookedItemIds}
      />

      {recentDays.length > 0 && (
        <div>
          <h2 className="text-muted-foreground mb-2 text-sm font-medium">Những ngày gần đây</h2>
          <div className="flex flex-wrap gap-1.5">
            {recentDays.map((recent) => (
              <Link key={recent.id} href={`/admin/menu?date=${recent.serviceDate}`}>
                <Badge
                  variant={statusVariant[recent.status]}
                  className="cursor-pointer gap-1.5 py-1"
                >
                  {formatServiceDateShort(recent.serviceDate)}
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
