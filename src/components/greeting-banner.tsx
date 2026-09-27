"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { greetingKey } from "@/lib/greeting";

const DISMISSED_KEY = "greeting-dismissed";

/**
 * The admin's wish, set in /admin/settings. Closing it is remembered in this
 * browser against the text itself, so a new wish shows again.
 *
 * Renders nothing until mounted: whether it was closed lives in localStorage,
 * which the server cannot see, and starting hidden means a diner who closed it
 * never sees it flash up and vanish.
 */
export function GreetingBanner({ message, icon }: { message: string; icon: string }) {
  const [visible, setVisible] = useState(false);
  const key = greetingKey(message);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED_KEY) === key) return;
    } catch {
      // Storage blocked: show it; closing will just not stick.
    }
    setVisible(true);
  }, [key]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, key);
    } catch {
      // Nothing to do — it is closed for this visit at least.
    }
  }

  if (!visible) return null;

  return (
    <div
      role="note"
      aria-label="Lời chúc"
      className="animate-in fade-in slide-in-from-top-1 relative flex gap-3 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 py-3 pr-10 pl-4 duration-300 dark:border-amber-900 dark:from-amber-950/60 dark:via-orange-950/50 dark:to-rose-950/50"
    >
      <span aria-hidden className="shrink-0 text-2xl leading-none">
        {icon}
      </span>
      <p className="text-sm leading-6 whitespace-pre-line text-amber-950 dark:text-amber-100">
        {message}
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Đóng lời chúc"
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-amber-800/70 transition-colors hover:bg-amber-900/10 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-100/10 dark:hover:text-amber-50"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
