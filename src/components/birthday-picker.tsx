"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { daysInMonth, type Birthday } from "@/lib/birthday";

/** A birthday being picked: either half may still be missing. */
export type BirthdayDraft = { month: number | null; day: number | null };

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Tháng ${i + 1}`,
}));
const DAYS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

/** The draft as a birthday, once both halves are picked and the day exists in that month. */
export function completeBirthday(draft: BirthdayDraft): Birthday | null {
  if (draft.month === null || draft.day === null) return null;
  if (draft.day > daysInMonth(draft.month)) return null;
  return { month: draft.month, day: draft.day };
}

/**
 * Day and month, no year — the year is never asked for. Picking a month too
 * short for the chosen day (31 then Tháng 2) clears the day rather than
 * leaving an impossible date on screen.
 */
export function BirthdayPicker({
  value,
  onChange,
  disabled,
  label,
}: {
  value: BirthdayDraft;
  onChange: (next: BirthdayDraft) => void;
  disabled?: boolean;
  /** Names the two selects for screen readers, e.g. whose birthday it is. */
  label: string;
}) {
  const maxDay = value.month === null ? 31 : daysInMonth(value.month);

  return (
    <div className="flex gap-2">
      <Select
        items={DAYS}
        value={value.day === null ? null : String(value.day)}
        onValueChange={(day) => onChange({ ...value, day: day === null ? null : Number(day) })}
        disabled={disabled}
      >
        <SelectTrigger aria-label={`${label} — ngày`} className="w-20">
          <SelectValue placeholder="Ngày" />
        </SelectTrigger>
        <SelectContent>
          {DAYS.slice(0, maxDay).map((day) => (
            <SelectItem key={day.value} value={day.value}>
              {day.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        items={MONTHS}
        value={value.month === null ? null : String(value.month)}
        onValueChange={(raw) => {
          const month = raw === null ? null : Number(raw);
          const day =
            month !== null && value.day !== null && value.day > daysInMonth(month) ? null : value.day;
          onChange({ month, day });
        }}
        disabled={disabled}
      >
        <SelectTrigger aria-label={`${label} — tháng`} className="w-28">
          <SelectValue placeholder="Tháng" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
