import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * On /login, the way back to the welcome screen — for a visitor who pressed
 * "Đăng nhập" before reading the invitation, or who came to /login directly.
 * The welcome page itself forwards to /login when it is off, so this is only
 * shown while it is on.
 */
export function WelcomeLinkBanner({ title }: { title: string }) {
  return (
    <Link
      href="/welcome"
      className="group animate-in fade-in slide-in-from-top-1 relative flex w-full max-w-[25rem] items-center gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-sky-50 px-4 py-3 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-rose-900 dark:from-rose-950/50 dark:via-orange-950/40 dark:to-sky-950/50"
    >
      <span aria-hidden className="shrink-0 text-2xl leading-none">
        💌
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-rose-950 dark:text-rose-100">
          {title || "Bạn có một thư mời"}
        </span>
        <span className="block text-xs text-rose-900/70 dark:text-rose-200/70">
          Xem thư mời và lịch trình
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-rose-800/70 transition-transform group-hover:translate-x-0.5 dark:text-rose-200/70" />
    </Link>
  );
}
