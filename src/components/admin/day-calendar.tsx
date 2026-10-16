"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addMonths, format, getDay } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatServiceDate, monthBounds, parseServiceDate, serviceDateRange, type ServiceDate } from "@/lib/date";
import { withSlot, type MenuSlot } from "@/lib/menu-slot";

// Vietnamese calendars start the week on Monday.
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * A month grid for jumping to any day's bill on Đơn hàng. Days with a menu or
 * a hand-written bill carry a dot; every day can be picked, since an empty day
 * is still where the admin goes to see that nothing was ordered. Tapping a day
 * only picks it — "Xem ngày này" goes there, "Đóng" leaves the page as it was.
 */
export function DayCalendar({
  selectedDate,
  today,
  markedDates,
  slot,
}: {
  selectedDate: ServiceDate;
  today: ServiceDate;
  markedDates: ServiceDate[];
  /** Kept on the destination, like the Hôm nay button beside it. */
  slot: MenuSlot;
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthBounds(selectedDate).start);
  const [picked, setPicked] = useState(selectedDate);

  // Every opening starts from the day on screen, not a pick left from last time.
  function toggle() {
    if (!open) {
      setPicked(selectedDate);
      setMonth(monthBounds(selectedDate).start);
    }
    setOpen(!open);
  }

  function accept() {
    startTransition(() => {
      router.push(withSlot(`/admin/bookings/${picked}`, slot));
      setOpen(false);
    });
  }

  const marked = new Set(markedDates);
  const { start, end } = monthBounds(month);
  const days = serviceDateRange(start, end);
  // getDay: Sunday 0 … Saturday 6 → Monday-first offset.
  const leadingBlanks = (getDay(parseServiceDate(start)) + 6) % 7;

  const shift = (by: number) =>
    setMonth(format(addMonths(parseServiceDate(month), by), "yyyy-MM-dd"));

  // A fragment, so the button sits among the day buttons and the open grid
  // wraps onto its own line beneath them.
  return (
    <>
      <Button size="sm" variant={open ? "default" : "outline"} onClick={toggle}>
        <CalendarDays className="size-4" />
        Chọn ngày
      </Button>

      {open && (
        <div className="bg-card basis-full rounded-lg border p-3 shadow-sm sm:max-w-xs">
          <div className="mb-2 flex items-center justify-between">
            <Button size="icon-sm" variant="ghost" onClick={() => shift(-1)} aria-label="Tháng trước">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium capitalize">
              {format(parseServiceDate(month), "LLLL yyyy", { locale: vi })}
            </span>
            <Button size="icon-sm" variant="ghost" onClick={() => shift(1)} aria-label="Tháng sau">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="text-muted-foreground py-1 font-medium">
                {weekday}
              </span>
            ))}
            {Array.from({ length: leadingBlanks }, (_, index) => (
              <span key={`blank-${index}`} />
            ))}
            {days.map((date) => {
              const isSelected = date === picked;
              const isToday = date === today;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setPicked(date)}
                  aria-pressed={isSelected}
                  className={`relative flex h-9 items-center justify-center rounded-md text-sm transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : isToday
                        ? "ring-primary hover:bg-accent font-semibold ring-1"
                        : "hover:bg-accent"
                  }`}
                >
                  {Number(date.slice(8))}
                  {marked.has(date) && (
                    <span
                      className={`absolute bottom-1 size-1 rounded-full ${
                        isSelected ? "bg-primary-foreground" : "bg-emerald-500"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            có thực đơn hoặc hoá đơn
          </p>

          <div className="mt-3 border-t pt-3">
            <p className="mb-2 text-sm">
              <span className="text-muted-foreground">Đã chọn: </span>
              <span className="font-medium">{formatServiceDate(picked)}</span>
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                <X className="size-4" />
                Đóng
              </Button>
              <Button
                size="sm"
                onClick={accept}
                disabled={isNavigating || picked === selectedDate}
              >
                {isNavigating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Xem ngày này
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
