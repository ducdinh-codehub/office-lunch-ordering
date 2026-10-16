"use client";

import Link from "next/link";
import { useState } from "react";
import { addMonths, format, getDay } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { monthBounds, parseServiceDate, serviceDateRange, type ServiceDate } from "@/lib/date";
import { withSlot, type MenuSlot } from "@/lib/menu-slot";

// Vietnamese calendars start the week on Monday.
const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * A month grid for jumping to any day's bill on Đơn hàng. Days with a menu or
 * a hand-written bill carry a dot; every day is a link, since an empty day is
 * still where the admin goes to see that nothing was ordered.
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
  /** Kept on every link, like the day buttons beside it. */
  slot: MenuSlot;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthBounds(selectedDate).start);

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
      <Button size="sm" variant={open ? "default" : "outline"} onClick={() => setOpen(!open)}>
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
              const isSelected = date === selectedDate;
              const isToday = date === today;
              return (
                <Link
                  key={date}
                  href={withSlot(`/admin/bookings/${date}`, slot)}
                  onClick={() => setOpen(false)}
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
                </Link>
              );
            })}
          </div>

          <p className="text-muted-foreground mt-2 flex items-center gap-1.5 text-xs">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
            có thực đơn hoặc hoá đơn
          </p>
        </div>
      )}
    </>
  );
}
