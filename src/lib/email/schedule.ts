import { TZDate } from "@date-fns/tz";
import { addMonths } from "date-fns";

import { APP_TIMEZONE } from "@/lib/date";
import type { EmailRepeat } from "@/db/schema";

export const REPEAT_LABEL: Record<EmailRepeat, string> = {
  none: "Không lặp",
  daily: "Mỗi ngày",
  weekly: "Mỗi tuần",
  monthly: "Mỗi tháng",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The first occurrence of a repeating job strictly after `after`, counted from
 * its anchor — never from the previous run, so a late cron call does not push
 * every later run late too, and runs missed while nothing called the cron are
 * skipped rather than sent in a burst. Null for a one-time job.
 *
 * Monthly steps are taken on the Vietnam calendar from the anchor each time:
 * a job set for the 31st runs on the 30th in a 30-day month and is back on the
 * 31st the month after. Vietnam has no daylight saving, so daily and weekly
 * steps are plain multiples of 24 hours.
 */
export function nextOccurrence(anchor: Date, repeat: EmailRepeat, after: Date): Date | null {
  if (repeat === "none") return null;
  if (after < anchor) return anchor;

  if (repeat === "daily" || repeat === "weekly") {
    const period = repeat === "daily" ? DAY_MS : 7 * DAY_MS;
    const steps = Math.floor((after.getTime() - anchor.getTime()) / period) + 1;
    return new Date(anchor.getTime() + steps * period);
  }

  const local = new TZDate(anchor, APP_TIMEZONE);
  const afterLocal = new TZDate(after, APP_TIMEZONE);
  // Start from the whole months between the two, then step past `after`.
  let steps = Math.max(
    1,
    (afterLocal.getFullYear() - local.getFullYear()) * 12 + (afterLocal.getMonth() - local.getMonth()),
  );
  let candidate = addMonths(local, steps);
  while (candidate.getTime() <= after.getTime()) {
    steps += 1;
    candidate = addMonths(local, steps);
  }
  return new Date(candidate.getTime());
}
