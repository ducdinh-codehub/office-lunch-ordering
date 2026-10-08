import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SeasonalBackdrop } from "@/components/themes/seasonal-backdrop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserDailyTotals, type DailyTotal } from "@/db/queries/bookings";
import { listManualBills } from "@/db/queries/manual-bills";
import { requireUser } from "@/lib/auth/session";
import { BIRTHDAY_PERCENT } from "@/lib/birthday";
import {
  formatServiceDate,
  shiftServiceDate,
  todayServiceDate,
  type ServiceDate,
} from "@/lib/date";
import { formatServiceTime } from "@/lib/manual-bill";
import { formatVnd } from "@/lib/money";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Đơn của tôi") };

export default async function MyBookingsPage() {
  const user = await requireUser();
  const today = todayServiceDate();

  // A window wide enough to cover tomorrow's advance bookings and past history.
  const from = shiftServiceDate(today, -180);
  const to = shiftServiceDate(today, 14);
  const [days, bills] = await Promise.all([
    getUserDailyTotals(user.id, from, to),
    listManualBills({ from, to, userId: user.id }),
  ]);

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
            <DayRow key={day.serviceDate} day={day} today={today} />
          ))}
        </div>
      )}

      {bills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden>🧾</span>
              Hoá đơn riêng
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bills.map((bill) => (
              <div key={bill.id} className="rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-medium">{bill.title ?? "Hoá đơn"}</p>
                  <span className="font-medium tabular-nums">{formatVnd(bill.totalVnd)}</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatServiceDate(bill.serviceDate)}
                  {bill.serviceTime && ` · ${formatServiceTime(bill.serviceTime)}`}
                </p>
                <ul className="text-muted-foreground mt-1.5 space-y-0.5 text-xs">
                  {bill.items.map((item, index) => (
                    <li key={index} className="flex justify-between gap-2">
                      <span className="truncate">
                        {item.name} × {item.quantity}
                      </span>
                      <span className="tabular-nums">{formatVnd(item.lineTotalVnd)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-muted-foreground text-xs">
              Đã cộng vào tiền của ngày đó ở trên — trả cùng lúc ở trang Thanh toán.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * One date. A date with a menu order opens as that order; one carrying only a
 * hand-written bill has no menu to open, so it is not a link.
 */
function DayRow({ day, today }: { day: DailyTotal; today: ServiceDate }) {
  const hasMenuOrder = day.itemCount > 0 || day.setCount > 0;
  const content = (
    <>
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
            : hasMenuOrder && `${day.itemCount} món`}
          {day.manualVnd > 0 && (
            <span>
              {hasMenuOrder && " · "}🧾 hoá đơn riêng {formatVnd(day.manualVnd)}
            </span>
          )}
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
      {hasMenuOrder && <ChevronRight className="text-muted-foreground size-4 shrink-0" />}
    </>
  );
  const className = "bg-background flex items-center gap-3 rounded-lg border px-4 py-3";

  if (!hasMenuOrder) return <div className={className}>{content}</div>;
  return (
    <Link
      // `xem=don` opens the day as your order: only the sittings you
      // ordered from get a tab, so an untouched party stays out of it.
      href={`/menu/${day.serviceDate}?xem=don`}
      className={`${className} hover:bg-accent transition-colors`}
    >
      {content}
    </Link>
  );
}
