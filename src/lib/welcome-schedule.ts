/**
 * The welcome screen's itinerary, written by the admin as plain text and laid
 * out as a timeline. The text is the only source; this is the one reading of
 * it, shared by /welcome and anything that previews it.
 *
 *   NGÀY 1 (12/04): ĐIỂM ĐI – ĐIỂM ĐẾN         ← a day: any line not starting with a bullet
 *   • 08:30: Xe đón cả đoàn…                   ← a stop: a bullet, optionally a time first
 *   • 10:15 – 12:00 (Khám phá tự do):          ← a time range and a label in brackets
 *       • Hoạt động tự chọn: Câu cá…           ← a detail: an indented bullet, "label: text"
 *
 * Anything that does not fit still shows — a stop without a time, a detail
 * without a label — so a typo never hides a line. Client-safe.
 */

export const WELCOME_SCHEDULE_MAX = 6000;

/**
 * Opens /welcome with the itinerary already showing — for anyone, signed in
 * or not, which is what lets a notice email link to it.
 */
export const WELCOME_SCHEDULE_PATH = "/welcome?lich-trinh=1";

/** The words of a notice email's link to the itinerary, unless the admin wrote their own. */
export const DEFAULT_SCHEDULE_LINK_LABEL = "Cùng xem lịch trình nào";
export const SCHEDULE_LINK_LABEL_MAX = 80;

export type ScheduleDetail = { label: string | null; text: string };

export type ScheduleStop = {
  time: string | null;
  label: string | null;
  text: string;
  /** Picked from the stop's own words, for a bit of fun on the timeline. */
  emoji: string;
  details: ScheduleDetail[];
};

export type ScheduleDay = {
  /** "Ngày 1 · 12/04", or the heading as written when it has another shape. */
  title: string;
  /** What follows the heading's first colon, e.g. "ĐIỂM ĐI – ĐIỂM ĐẾN". */
  subtitle: string | null;
  stops: ScheduleStop[];
};

const BULLET = /^(\s*)[•\-*·]\s+(.*)$/u;
/** "08:30", "10:15 – 12:00", "19:00 – Muộn", then an optional "(label)", then ":". */
const TIMED =
  /^(\d{1,2}[:h]\d{2}(?:\s*[–—-]\s*(?:\d{1,2}[:h]\d{2}|[^\s(:]+))?)\s*(?:\(([^)]*)\))?\s*:?\s*(.*)$/u;
const DAY = /^ngày\s*(\d+)\s*(?:\(([^)]*)\))?/iu;

/** First match wins, so the more specific moments come first. */
const EMOJI: Array<[RegExp, string]> = [
  [/party|tiệc|bung nóc/iu, "🎉"],
  [/karaoke|hát hò/iu, "🎤"],
  [/bơi/iu, "🏊"],
  [/câu cá/iu, "🎣"],
  [/về tới|kết thúc/iu, "🏁"],
  [/thức dậy/iu, "🌄"],
  [/ăn sáng/iu, "🥐"],
  [/ăn trưa|ăn tối|bữa|ăn uống/iu, "🍜"],
  [/nhận phòng/iu, "🏡"],
  [/trả phòng|thu dọn/iu, "🧳"],
  [/xe đón|lên xe|khởi hành|xuất phát/iu, "🚌"],
  [/đến nơi/iu, "📍"],
  [/khám phá|check-in|chụp ảnh/iu, "📸"],
  [/boardgame|chơi bài/iu, "🃏"],
];

function emojiFor(words: string): string {
  return EMOJI.find(([pattern]) => pattern.test(words))?.[1] ?? "✨";
}

function parseDay(line: string): Pick<ScheduleDay, "title" | "subtitle"> {
  const colon = line.indexOf(":");
  const head = (colon >= 0 ? line.slice(0, colon) : line).trim();
  const subtitle = colon >= 0 ? line.slice(colon + 1).trim() || null : null;
  const day = DAY.exec(head);
  if (!day) return { title: head, subtitle };
  return { title: day[2] ? `Ngày ${day[1]} · ${day[2].trim()}` : `Ngày ${day[1]}`, subtitle };
}

function parseStop(body: string): ScheduleStop {
  const timed = TIMED.exec(body);
  const time = timed ? timed[1].replace(/\s*[–—-]\s*/u, " – ") : null;
  const label = timed?.[2]?.trim() || null;
  const text = (timed ? timed[3] : body).trim();
  return { time, label, text, emoji: emojiFor(`${label ?? ""} ${text}`), details: [] };
}

function parseDetail(body: string): ScheduleDetail {
  // "Hát hò & Nhảy múa: Bật loa…" — a short lead-in before a colon is a label.
  const colon = body.indexOf(": ");
  if (colon > 0 && colon <= 48) {
    return { label: body.slice(0, colon).trim(), text: body.slice(colon + 2).trim() };
  }
  return { label: null, text: body.trim() };
}

export function parseSchedule(source: string): ScheduleDay[] {
  const days: ScheduleDay[] = [];
  for (const raw of source.split("\n")) {
    if (raw.trim() === "") continue;
    const bullet = BULLET.exec(raw.replace(/\t/g, "    "));

    if (!bullet) {
      days.push({ ...parseDay(raw.trim()), stops: [] });
      continue;
    }

    // A stop before any heading still needs a day to live in.
    if (days.length === 0) days.push({ title: "Lịch trình", subtitle: null, stops: [] });
    const day = days[days.length - 1];
    const indented = bullet[1].length > 0;
    const last = day.stops[day.stops.length - 1];

    if (indented && last) last.details.push(parseDetail(bullet[2]));
    else day.stops.push(parseStop(bullet[2]));
  }
  return days.filter((day) => day.stops.length > 0);
}
