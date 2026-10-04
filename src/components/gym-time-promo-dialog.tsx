"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { ArrowUpRight, Dumbbell } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

// Every sign-in mints a new Clerk session id, so keying "seen" on it shows the
// dialog once per login — not on every navigation or reload in between.
const SEEN_KEY = "gym-time-promo-seen-session";

/** Rendered only where `serverEnv.gymTimeUrl` is set — see src/env.ts. */
export function GymTimePromoDialog({ url }: { url: string }) {
  const { sessionId } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === sessionId) return;
      localStorage.setItem(SEEN_KEY, sessionId);
    } catch {
      // Storage blocked: showing it on every load beats never showing it.
    }
    setOpen(true);
  }, [sessionId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Gym Time's own palette, as in the home-page banner. */}
      <DialogContent className="gap-5 bg-[#121214] p-6 text-[#f6f6f3] ring-[#d7ff3e]/20 [&_[data-slot=dialog-close]]:text-[#f6f6f3]/70 [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-[#f6f6f3]">
        <span className="grid size-12 place-items-center rounded-full bg-[#d7ff3e] text-[#1b1f06]">
          <Dumbbell className="size-6" />
        </span>
        <div className="space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Ăn no rồi, đi tập với{" "}
            <span className="rounded-lg bg-[#d7ff3e] px-2 text-[#1b1f06]">Gym Time</span>
          </DialogTitle>
          <DialogDescription className="text-sm leading-6 text-[#f6f6f3]/70">
            Kho bài tập lên đến 1000 bài, AI tự động gợi ý và lên lịch tập chỉ bằng một click.
          </DialogDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#d7ff3e] px-4 py-2.5 text-sm font-semibold text-[#1b1f06] transition-opacity hover:opacity-90"
          >
            Khám phá ngay
            <ArrowUpRight className="size-4" />
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-full border border-white/15 px-4 py-2.5 text-sm text-[#f6f6f3]/80 transition-colors hover:bg-white/10"
          >
            Để sau
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
