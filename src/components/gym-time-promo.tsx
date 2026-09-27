import { ArrowUpRight, Dumbbell } from "lucide-react";

export const GYM_TIME_URL = "https://example.com/";

// Colours are Gym Time's own palette (ink / lime accent / canvas), not this
// app's theme, so the banner reads as that site in both light and dark mode.
export function GymTimePromo() {
  return (
    <a
      href={GYM_TIME_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-2xl bg-[#121214] px-4 py-3 text-[#f6f6f3] transition-transform hover:-translate-y-0.5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#d7ff3e] text-[#1b1f06]">
        <Dumbbell className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold tracking-tight">
          Thử <span className="rounded-md bg-[#d7ff3e] px-1.5 text-[#1b1f06]">Gym Time</span>{" "}
          — ăn xong thì đi tập!
        </span>
        <span className="block truncate text-xs text-[#f6f6f3]/60">
          Kho 1000 bài tập, AI gợi ý lịch tập chỉ bằng một click.
        </span>
      </span>
      <ArrowUpRight className="size-5 shrink-0 text-[#d7ff3e] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}
