"use client";

import { useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { ScheduleDay } from "@/lib/welcome-schedule";
import { cn } from "@/lib/utils";

/** Each day gets its own warm accent, cycling if there are more days than these. */
const DAY_ACCENTS = [
  {
    tab: "bg-amber-500 text-white",
    bubble: "bg-amber-100 dark:bg-amber-950",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  {
    tab: "bg-sky-600 text-white",
    bubble: "bg-sky-100 dark:bg-sky-950",
    chip: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  },
  {
    tab: "bg-emerald-600 text-white",
    bubble: "bg-emerald-100 dark:bg-emerald-950",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  },
];

type Accent = (typeof DAY_ACCENTS)[number];

/**
 * "Xem lịch trình": the trip's itinerary as a timeline, one day per panel,
 * each stop with its time, an emoji for what happens there and its details.
 * The party gets a little extra glow. Opened from a link at the foot of the
 * card.
 *
 * The days sit side by side on a scroll-snapping track, so a swipe moves
 * between them with the phone's own momentum, and a trackpad's two-finger
 * swipe does too. A mouse cannot scroll sideways, so it drags the track
 * instead, and ← → step a day. The tabs follow the track, and tapping one
 * slides the track to it.
 */
export function ScheduleDialog({
  days,
  triggerClassName,
  defaultOpen = false,
}: {
  days: ScheduleDay[];
  triggerClassName?: string;
  /** Open on arrival — the notice email's link lands here. */
  defaultOpen?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [dragging, setDragging] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  // Where a mouse drag started; `moved` turns a press into a drag after a few pixels.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);

  function onScroll() {
    const element = track.current;
    if (!element || element.clientWidth === 0) return;
    const index = Math.round(element.scrollLeft / element.clientWidth);
    if (index !== active) setActive(index);
  }

  function show(index: number) {
    const element = track.current;
    if (!element) return;
    const target = Math.max(0, Math.min(days.length - 1, index));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: target * element.clientWidth, behavior: reduced ? "auto" : "smooth" });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    // Touch and pen already scroll the track natively.
    if (event.pointerType !== "mouse" || event.button !== 0 || !track.current) return;
    drag.current = { x: event.clientX, left: track.current.scrollLeft, moved: false };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const element = track.current;
    const start = drag.current;
    if (!element || !start) return;
    const dx = event.clientX - start.x;
    if (!start.moved) {
      if (Math.abs(dx) < 5) return;
      start.moved = true;
      setDragging(true);
      element.setPointerCapture(event.pointerId);
    }
    // The press began a text selection before it became a drag; drop it.
    window.getSelection()?.removeAllRanges();
    element.scrollLeft = start.left - dx;
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const element = track.current;
    const start = drag.current;
    drag.current = null;
    if (!element || !start?.moved) return;
    // A fifth of a panel is enough to turn the page, either way.
    const width = element.clientWidth;
    const dx = event.clientX - start.x;
    const from = Math.round(start.left / width);
    const step = dx < -width / 5 ? 1 : dx > width / 5 ? -1 : 0;
    // The click a drag produces fires right after this; anything later is a real click.
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    setDragging(false);
    requestAnimationFrame(() => show(from + step));
  }

  return (
    <Dialog defaultOpen={defaultOpen} onOpenChange={(open) => open && setActive(0)}>
      <DialogTrigger className={triggerClassName}>
        <span aria-hidden>🗺️</span>
        Xem lịch trình
        <span aria-hidden>→</span>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") show(active + 1);
          else if (event.key === "ArrowLeft") show(active - 1);
        }}
      >
        <div className="bg-gradient-to-br from-amber-100 via-orange-50 to-rose-100 px-5 pt-5 pb-4 dark:from-amber-950/60 dark:via-stone-900 dark:to-rose-950/50">
          <DialogTitle className="text-lg font-semibold">🎒 Lịch trình đi quẩy</DialogTitle>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Lưu lại để không lỡ chuyến xe nào nhé!
          </p>
          {days.length > 1 && (
            <div
              role="tablist"
              aria-label="Chọn ngày"
              className="mt-4 flex gap-2 overflow-x-auto"
            >
              {days.map((entry, i) => (
                <button
                  key={entry.title}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  onClick={() => show(i)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    i === active
                      ? DAY_ACCENTS[i % DAY_ACCENTS.length].tab
                      : "bg-white/70 hover:bg-white dark:bg-white/10 dark:hover:bg-white/20",
                  )}
                >
                  {entry.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* One full-width panel per day; each scrolls on its own, the track sideways —
            neither shows a scrollbar. */}
        <div
          ref={track}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          // A drag that ends over a link or button must not also click it.
          onClickCapture={(event) => {
            if (!justDragged.current) return;
            justDragged.current = false;
            event.preventDefault();
            event.stopPropagation();
          }}
          className={cn(
            "flex min-h-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // Snapping would fight the mouse mid-drag; it comes back on release.
            dragging ? "cursor-grabbing select-none" : "snap-x snap-mandatory md:cursor-grab",
          )}
        >
          {days.map((day, i) => (
            <section
              key={day.title}
              aria-label={day.title}
              className="w-full shrink-0 snap-start snap-always overflow-y-auto px-5 pt-4 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <DayTimeline
                day={day}
                accent={DAY_ACCENTS[i % DAY_ACCENTS.length]}
                showTitle={days.length === 1}
              />
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DayTimeline({
  day,
  accent,
  showTitle,
}: {
  day: ScheduleDay;
  accent: Accent;
  /** With a single day there are no tabs, so its name goes above the line. */
  showTitle: boolean;
}) {
  return (
    <>
      {(day.subtitle || showTitle) && (
        <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-wide uppercase">
          {[showTitle && day.title, day.subtitle].filter(Boolean).join(" · ")}
        </p>
      )}
      {/* The line down the left joins the stops into one journey. */}
      <ol className="before:bg-border relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[1.125rem] before:w-0.5 before:rounded-full">
        {day.stops.map((stop, i) => {
          const party = stop.emoji === "🎉";
          return (
            <li key={i} className="relative pl-12">
              <span
                aria-hidden
                className={cn(
                  "ring-background absolute top-0 left-0 grid size-9 place-items-center rounded-full text-lg shadow-sm ring-4",
                  party
                    ? "bg-gradient-to-br from-fuchsia-200 to-amber-200 dark:from-fuchsia-900 dark:to-amber-900"
                    : accent.bubble,
                )}
              >
                {stop.emoji}
              </span>
              <div
                className={cn(
                  party &&
                    "-mx-2 rounded-xl bg-gradient-to-br from-fuchsia-50 to-amber-50 px-2 py-2 dark:from-fuchsia-950/40 dark:to-amber-950/30",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {stop.time && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                        accent.chip,
                      )}
                    >
                      {stop.time}
                    </span>
                  )}
                  {stop.label && <span className="font-semibold">{stop.label}</span>}
                </div>
                {stop.text && <p className="mt-1 text-sm leading-relaxed">{stop.text}</p>}
                {stop.details.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {stop.details.map((detail, j) => (
                      <li key={j} className="bg-muted/60 rounded-lg px-3 py-2 text-sm leading-relaxed">
                        {detail.label && <span className="font-medium">{detail.label}: </span>}
                        {detail.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
