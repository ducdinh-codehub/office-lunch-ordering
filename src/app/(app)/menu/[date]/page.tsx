import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { MenuDayView } from "@/components/menu/menu-day-view";
import { CloseButton } from "@/components/layout/close-button";
import { getMenuDay } from "@/db/queries/menu";
import { requireUser } from "@/lib/auth/session";
import { parseSelectedTier } from "@/lib/set-tiers";
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
  searchParams: Promise<{ suat?: string }>;
}) {
  const [{ date }, { suat }] = await Promise.all([params, searchParams]);
  if (!isServiceDate(date)) notFound();

  const user = await requireUser();
  const day = await getMenuDay(date);

  // Drafts are admin-only; to everyone else the day simply has no menu.
  const visibleDay = day && day.status === "draft" && !user.isAdmin ? null : day;

  const previous = shiftServiceDate(date, -1);
  const next = shiftServiceDate(date, 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/menu/${previous}`}
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
            href={`/menu/${next}`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            {formatServiceDateShort(next)}
            <ChevronRight className="size-4" />
          </Link>
          {/* Back to the list this day was opened from — usually Đơn của tôi. */}
          <CloseButton fallbackHref="/me/bookings" label="Đóng, quay lại danh sách" />
        </div>
      </div>

      <MenuDayView
        serviceDate={date}
        day={visibleDay}
        userId={user.id}
        selectedTier={parseSelectedTier(suat)}
      />
    </div>
  );
}
