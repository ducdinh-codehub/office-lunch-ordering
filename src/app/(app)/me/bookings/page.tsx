import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SeasonalBackdrop } from "@/components/themes/seasonal-backdrop";
import { Card, CardContent } from "@/components/ui/card";
import { getUserDailyTotals } from "@/db/queries/bookings";
import { requireUser } from "@/lib/auth/session";
import { BIRTHDAY_PERCENT } from "@/lib/birthday";
import { formatServiceDate, shiftServiceDate, todayServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Đơn của tôi") };

export default async function MyBookingsPage() {
  const user = await requireUser();
  const today = todayServiceDate();

  // A window wide enough to cover tomorrow's advance bookings and past history.
  const days = await getUserDailyTotals(
    user.id,
    shiftServiceDate(today, -180),
    shiftServiceDate(today, 14),
  );

  const grandTotal = days.reduce((total, day) => total + day.totalVnd, 0);

  return (
    <div className="relative isolate space-y-5">
      <SeasonalBackdrop />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Đơn của tôi</h1>
        <p className="text-muted-foreground text-sm">
          {days.length} ngày · tổng cộng {formatVnd(grandTotal)}
        </p>
      </div>

      {days.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            <p className="text-3xl" aria-hidden>
              🥢
            </p>
            <p className="mt-3 font-medium">Bạn chưa đặt món nào.</p>
            <Link href="/" className="mt-2 inline-block text-sm underline underline-offset-4">
              Xem thực đơn hôm nay
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {days.map((day) => (
            <Link
              key={day.serviceDate}
              // `xem=don` opens the day as your order: only the sittings you
              // ordered from get a tab, so an untouched party stays out of it.
              href={`/menu/${day.serviceDate}?xem=don`}
              className="bg-background hover:bg-accent flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {formatServiceDate(day.serviceDate)}
                  {day.serviceDate === today && (
                    <span className="text-muted-foreground ml-2 text-xs">Hôm nay</span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm">
                  {/* A date can bill two suất — lunch plus an afternoon party. */}
                  {day.setCount > 0
                    ? `${day.setCount} suất · ${day.itemCount} món`
                    : `${day.itemCount} món`}
                  {/* Only when a suất was actually started and left short. A
                      per-dish menu has none to be incomplete. */}
                  {day.incompleteSet && (
                    <span className="text-amber-700 dark:text-amber-500"> · suất chưa đủ món</span>
                  )}
                  {day.luckyPercent !== null && (
                    <span className="text-red-700 dark:text-red-400">
                      {" "}
                      · 🧧 lì xì −{day.luckyPercent}%
                    </span>
                  )}
                  {day.birthday && (
                    <span className="text-pink-700 dark:text-pink-400">
                      {" "}
                      · 🎂 sinh nhật −{BIRTHDAY_PERCENT}%
                    </span>
                  )}
                  {day.adminDiscount && (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {" "}
                      · 🎁 {day.adminDiscount.note ?? "giảm giá"} −{day.adminDiscount.percent}%
                    </span>
                  )}
                </p>
              </div>
              <span className="font-medium tabular-nums">{formatVnd(day.totalVnd)}</span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
