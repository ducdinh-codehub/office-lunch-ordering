import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MenuDayView } from "@/components/menu/menu-day-view";
import { SlotSection } from "@/components/menu/slot-section";
import { Card, CardContent } from "@/components/ui/card";
import { getMenuDay } from "@/db/queries/menu";
import { getUserBookingsForDay } from "@/db/queries/bookings";
import { SLOT_LABEL, resolveActiveSlot } from "@/lib/menu-slot";
import { getUserLedger, settleableEntries } from "@/db/queries/payments";
import { requireUser } from "@/lib/auth/session";
import { parseSelectedTier } from "@/lib/set-tiers";
import { formatServiceDateShort, shiftServiceDate, todayServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ suat?: string; suatChieu?: string }>;
}) {
  const [{ suat, suatChieu }, user] = await Promise.all([searchParams, requireUser()]);
  const today = todayServiceDate();
  const tomorrow = shiftServiceDate(today, 1);

  const [lunchDay, afternoonDay, tomorrowDay, ledger] = await Promise.all([
    getMenuDay(today),
    getMenuDay(today, "afternoon"),
    getMenuDay(tomorrow),
    // 90 days back is plenty to surface anything still owed.
    getUserLedger(user.id, shiftServiceDate(today, -90), today),
  ]);

  const outstanding = settleableEntries(ledger);
  const outstandingTotal = outstanding.reduce((total, entry) => total + entry.owedVnd, 0);

  const firstName = (user.displayName ?? user.email.split("@")[0]).split(" ")[0];
  const tomorrowIsBookable = tomorrowDay && tomorrowDay.status !== "draft";

  // With a published party, today holds two menus, and each becomes a section
  // that folds away. Both stay on the page even once one is locked — a locked
  // menu is still what you ordered and owe — but a locked one starts folded,
  // leaving open whichever is still taking orders.
  const party = afternoonDay !== null && afternoonDay.status !== "draft" ? afternoonDay : null;
  const [lunchCount, partyCount] = party
    ? await Promise.all([
        lunchDay ? countBooked(user.id, lunchDay.id) : 0,
        countBooked(user.id, party.id),
      ])
    : [0, 0];

  // Which of the two is the day right now: lunch, until it locks and hands
  // over to an open party. The party starts open when it is — or when you have
  // already ordered from it, so what you owe is not hidden behind a tap.
  const activeSlot = resolveActiveSlot(
    [lunchDay, afternoonDay].filter((menu) => menu !== null),
  );
  const lunchOpen = lunchDay?.status !== "locked";
  const partyOpen =
    party?.status !== "locked" && (activeSlot === "afternoon" || partyCount > 0);

  const lunchView = (
    <MenuDayView
      serviceDate={today}
      day={lunchDay}
      userId={user.id}
      selectedTier={parseSelectedTier(suat)}
    />
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chào {firstName} 👋</h1>
        <p className="text-muted-foreground text-sm">Hôm nay có món gì nào.</p>
      </div>

      {outstandingTotal > 0 && (
        <Link href="/me/payments" className="block">
          <Card className="border-amber-300 bg-amber-50 transition-colors hover:bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/40">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Bạn còn nợ {formatVnd(outstandingTotal)}
                </p>
                <p className="text-sm text-amber-800/80 dark:text-amber-300/70">
                  trong {outstanding.length} ngày — chạm để thanh toán
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-amber-700 dark:text-amber-300" />
            </CardContent>
          </Card>
        </Link>
      )}

      {!party && lunchView}

      {party && (
        <SlotSection
          tone="lunch"
          emoji="🍱"
          label={`${SLOT_LABEL.lunch} hôm nay`}
          summary={slotSummary(lunchCount, lunchDay?.items.length ?? 0)}
          defaultOpen={lunchOpen}
        >
          {lunchView}
        </SlotSection>
      )}

      {party && (
        <SlotSection
          tone="afternoon"
          emoji="🎉"
          label={`${SLOT_LABEL.afternoon} hôm nay`}
          summary={slotSummary(partyCount, party.items.length)}
          defaultOpen={partyOpen}
        >
          {/* Its own suất parameter: sharing `suat` with lunch would make
              choosing a suất on one move the other. */}
          <MenuDayView
            serviceDate={today}
            slot="afternoon"
            day={party}
            userId={user.id}
            selectedTier={parseSelectedTier(suatChieu)}
            tierParam="suatChieu"
          />
        </SlotSection>
      )}

      {tomorrowIsBookable && (
        <Link
          href={`/menu/${tomorrow}`}
          className="text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors"
        >
          <span>Đã có thực đơn ngày mai — {formatServiceDateShort(tomorrow)}</span>
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

/** How many dishes, counting quantity, the diner has booked on one menu. */
async function countBooked(userId: string, menuDayId: string): Promise<number> {
  const lines = await getUserBookingsForDay(userId, menuDayId);
  return lines.reduce((total, line) => total + line.quantity, 0);
}

/** A folded section's right-hand status: what you ordered, or what is on offer. */
function slotSummary(bookedCount: number, dishCount: number) {
  return bookedCount > 0 ? (
    <span className="font-medium">đã chọn {bookedCount}</span>
  ) : (
    <span className="opacity-80">{dishCount} món</span>
  );
}
