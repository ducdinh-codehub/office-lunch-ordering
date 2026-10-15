import { buttonVariants } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { ScheduleDialog } from "@/components/welcome/schedule-dialog";
import type { ScheduleDay } from "@/lib/welcome-schedule";

/**
 * The welcome screen's invitation, brought to the home page for people who
 * are already signed in and so never pass /welcome again. "Mở thư mời" opens
 * it full screen (`/welcome?thu-moi=1`); the itinerary opens here, in the same
 * dialog the invitation uses.
 */
export function InvitationBanner({ title, schedule }: { title: string; schedule: ScheduleDay[] }) {
  return (
    <div
      role="note"
      aria-label="Thư mời"
      className="animate-in fade-in slide-in-from-top-1 flex flex-col gap-3 rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-sky-50 p-4 duration-300 sm:flex-row sm:items-center dark:border-rose-900 dark:from-rose-950/50 dark:via-orange-950/40 dark:to-sky-950/50"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span aria-hidden className="shrink-0 text-3xl leading-none">
          💌
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-rose-950 dark:text-rose-100">
            {title || "Bạn có một thư mời"}
          </p>
          <p className="text-sm text-rose-900/70 dark:text-rose-200/70">
            Mở thư mời để xem chi tiết chuyến đi nhé.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <LinkButton href="/welcome?thu-moi=1" size="sm">
          <span aria-hidden>💌</span>
          Mở thư mời
        </LinkButton>
        {schedule.length > 0 && (
          <ScheduleDialog
            days={schedule}
            triggerClassName={buttonVariants({ variant: "outline", size: "sm" })}
          />
        )}
      </div>
    </div>
  );
}
