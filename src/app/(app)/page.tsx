import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MenuDayView } from "@/components/menu/menu-day-view";
import { Card, CardContent } from "@/components/ui/card";
import { getMenuDay } from "@/db/queries/menu";
import { getUserLedger, settleableEntries } from "@/db/queries/payments";
import { requireUser } from "@/lib/auth/session";
import { parseSelectedTier } from "@/lib/set-tiers";
import { formatServiceDateShort, shiftServiceDate, todayServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ suat?: string }>;
}) {
  const [{ suat }, user] = await Promise.all([searchParams, requireUser()]);
  const today = todayServiceDate();
  const tomorrow = shiftServiceDate(today, 1);

  const [day, tomorrowDay, ledger] = await Promise.all([
    getMenuDay(today),
    getMenuDay(tomorrow),
    // 90 days back is plenty to surface anything still owed.
    getUserLedger(user.id, shiftServiceDate(today, -90), today),
  ]);

  const outstanding = settleableEntries(ledger);
  const outstandingTotal = outstanding.reduce((total, entry) => total + entry.owedVnd, 0);

  const firstName = (user.displayName ?? user.email.split("@")[0]).split(" ")[0];
  const tomorrowIsBookable = tomorrowDay && tomorrowDay.status !== "draft";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chào {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm">Hôm nay có món gì nào.</p>
      </div>

      {outstandingTotal > 0 && (
        <Link href="/me/payments" className="block">
          <Card className="border-amber-300 bg-amber-50 transition-colors hover:bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Bạn còn nợ {formatVnd(outstandingTotal)}
                </p>
                <p className="text-sm text-amber-800/80 dark:text-amber-300/70">
                  trong {outstanding.length} ngày — chạm để thanh toán
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-amber-700 dark:text-amber-300" />
            </CardContent>
          </Card>
        </Link>
      )}

      <MenuDayView
        serviceDate={today}
        day={day}
        userId={user.id}
        selectedTier={parseSelectedTier(suat)}
      />

      {tomorrowIsBookable && (
        <Link
          href={`/menu/${tomorrow}`}
          className="text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors"
        >
          <span>Đã có thực đơn ngày mai — {formatServiceDateShort(tomorrow)}</span>
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
