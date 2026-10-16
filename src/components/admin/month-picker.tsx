"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { monthBounds, type ServiceDate } from "@/lib/date";

/** `YYYY-MM`, the month part of a service date. */
type MonthKey = string;

const monthKey = (date: ServiceDate): MonthKey => date.slice(0, 7);
const monthLabel = (key: MonthKey) => `Tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`;

/**
 * Picks a whole month for Bảng thu tiền: a year of month buttons, paged by
 * year. Months holding a menu or a hand-written bill carry a dot. Tapping a
 * month only picks it — "Xem tháng này" goes there, "Đóng" leaves the page as
 * it was.
 */
export function MonthPicker({
  from,
  to,
  today,
  markedDates,
}: {
  /** The range on screen; it only counts as a picked month when it is one. */
  from: ServiceDate;
  to: ServiceDate;
  today: ServiceDate;
  markedDates: ServiceDate[];
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const bounds = monthBounds(from);
  const shownMonth = bounds.start === from && bounds.end === to ? monthKey(from) : null;
  const [picked, setPicked] = useState<MonthKey>(shownMonth ?? monthKey(today));
  const [year, setYear] = useState(Number(picked.slice(0, 4)));

  // Every opening starts from the month on screen, not a pick left from last time.
  function toggle() {
    if (!open) {
      const start = shownMonth ?? monthKey(today);
      setPicked(start);
      setYear(Number(start.slice(0, 4)));
    }
    setOpen(!open);
  }

  function accept() {
    const { start, end } = monthBounds(`${picked}-01`);
    startTransition(() => {
      router.push(`/admin/payments?from=${start}&to=${end}`);
      setOpen(false);
    });
  }

  const marked = new Set(markedDates.map(monthKey));
  const currentMonth = monthKey(today);

  // A fragment, so the button sits beside Tháng này and the open picker wraps
  // onto its own line beneath them.
  return (
    <>
      <Button size="sm" variant={open ? "default" : "outline"} onClick={toggle}>
        <CalendarDays className="size-4" />
        Chọn tháng
      </Button>

      {open && (
        <div className="bg-card basis-full rounded-lg border p-3 shadow-sm sm:max-w-xs">
          <div className="mb-2 flex items-center justify-between">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setYear(year - 1)}
              aria-label="Năm trước"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium">Năm {year}</span>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => setYear(year + 1)}
              aria-label="Năm sau"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, index) => {
              const key = `${year}-${String(index + 1).padStart(2, "0")}`;
              const isPicked = key === picked;
              const isCurrent = key === currentMonth;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicked(key)}
                  aria-pressed={isPicked}
                  className={`relative flex h-10 items-center justify-center rounded-md text-sm transition-colors ${
                    isPicked
                      ? "bg-primary text-primary-foreground font-semibold"
                      : isCurrent
                        ? "ring-primary hover:bg-accent font-semibold ring-1"
                        : "hover:bg-accent"
                  }`}
                >
                  Th {index + 1}
                  {marked.has(key) && (
                    <span
                      className={`absolute bottom-1 size-1 rounded-full ${
                        isPicked ? "bg-primary-foreground" : "bg-emerald-500"
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
              <span className="font-medium">{monthLabel(picked)}</span>
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                <X className="size-4" />
                Đóng
              </Button>
              <Button
                size="sm"
                onClick={accept}
                disabled={isNavigating || picked === shownMonth}
              >
                {isNavigating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Xem tháng này
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
