import { TZDate } from "@date-fns/tz";
import { addDays, format, parse, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";

/**
 * Everything in this app is anchored to Vietnam local time. The server may run
 * in UTC, so "today" must never come from a bare `new Date()`.
 */
export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";

/** A calendar day, formatted `YYYY-MM-DD`. Matches Postgres `date` columns. */
export type ServiceDate = string;

/** Today's calendar date in Vietnam, regardless of where the server runs. */
export function todayServiceDate(): ServiceDate {
  return format(new TZDate(Date.now(), APP_TIMEZONE), "yyyy-MM-dd");
}

export function shiftServiceDate(iso: ServiceDate, days: number): ServiceDate {
  return format(addDays(parseServiceDate(iso), days), "yyyy-MM-dd");
}

/** Parses `YYYY-MM-DD` into a Date at local midnight. Throws on bad input. */
export function parseServiceDate(iso: ServiceDate): Date {
  const parsed = parse(iso, "yyyy-MM-dd", startOfDay(new Date()));
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid service date: ${iso}`);
  }
  return parsed;
}

export function isServiceDate(value: unknown): value is ServiceDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** e.g. "Thứ Ba, 16/09/2025" */
export function formatServiceDate(iso: ServiceDate): string {
  return format(parseServiceDate(iso), "EEEE, dd/MM/yyyy", { locale: vi });
}

/** e.g. "Thứ 3 16/09" — for dense table headers. */
export function formatServiceDateShort(iso: ServiceDate): string {
  return format(parseServiceDate(iso), "EEE dd/MM", { locale: vi });
}

/** Renders an instant in Vietnam time, e.g. "16/09, 10:30". */
export function formatInstant(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return format(new TZDate(date, APP_TIMEZONE), "dd/MM, HH:mm", { locale: vi });
}

/** Inclusive list of dates from `start` to `end`, capped to avoid runaway loops. */
export function serviceDateRange(
  start: ServiceDate,
  end: ServiceDate,
  maxDays = 92,
): ServiceDate[] {
  const dates: ServiceDate[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < maxDays) {
    dates.push(cursor);
    cursor = shiftServiceDate(cursor, 1);
  }
  return dates;
}

/** First and last day of the month containing `iso`. */
export function monthBounds(iso: ServiceDate): { start: ServiceDate; end: ServiceDate } {
  const date = parseServiceDate(iso);
  const start = format(new Date(date.getFullYear(), date.getMonth(), 1), "yyyy-MM-dd");
  const end = format(new Date(date.getFullYear(), date.getMonth() + 1, 0), "yyyy-MM-dd");
  return { start, end };
}

/**
 * Converts a Vietnam-local `YYYY-MM-DDTHH:mm` (what an `<input type="datetime-local">`
 * produces) into a real instant. Without this the cutoff would be read in the
 * server's timezone and be hours off.
 */
export function localInputToInstant(value: string): Date {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(new TZDate(year, month - 1, day, hour, minute, 0, APP_TIMEZONE).getTime());
}

/** Inverse of `localInputToInstant`, for pre-filling the form. */
export function instantToLocalInput(value: Date | string | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return format(new TZDate(date, APP_TIMEZONE), "yyyy-MM-dd'T'HH:mm");
}
