"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { switchSetTier } from "@/app/(app)/menu/actions";
import { formatVnd } from "@/lib/money";
import type { SetTierKey } from "@/db/schema";

export type TierChoice = {
  key: SetTierKey;
  priceVnd: number;
  /** e.g. "2 món chính · 1 món phụ · 1 món rau" — read out to screen readers. */
  composition: string;
};

/**
 * The day's suất, as the thing you choose between.
 *
 * On a day with two, tapping a badge is how a diner says which one they want.
 * The choice itself rides in the `suat` query parameter, so the server
 * re-renders the dish sections with that suất's quotas and nothing has to be
 * mirrored in client state; the dishes picked for the suất being left are
 * cleared first, because the two take different numbers of món chính and a
 * carried-over selection would start the new suất already over quota.
 *
 * A day with a single suất has nothing to choose, so its badge stays a plain
 * label — as does every badge once the day stops taking orders.
 */
export function SetTierBadges({
  tiers,
  activeKey,
  menuDayId,
  canBook,
  onBehalfOf,
  param = "suat",
}: {
  tiers: TierChoice[];
  activeKey: SetTierKey | null;
  menuDayId: string;
  canBook: boolean;
  onBehalfOf?: string;
  /**
   * The query parameter the choice is written to. Two menus on one page need
   * one each, or choosing a suất on one would move the other.
   */
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  if (tiers.length === 0) return null;

  const hrefFor = (key: SetTierKey) => {
    // Keep whatever else is in the URL — the admin ordering for someone else is
    // identified by `for`, and losing it would drop them back to their own menu.
    const next = new URLSearchParams(searchParams.toString());
    next.set(param, key);
    return `${pathname}?${next.toString()}`;
  };

  function choose(key: SetTierKey) {
    if (key === activeKey || isPending) return;
    startTransition(async () => {
      const result = await switchSetTier({ menuDayId, tier: key, onBehalfOf });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.data && result.data.cleared > 0) {
        toast.success("Đã bỏ các món của suất cũ. Mời bạn chọn lại.");
      }
      router.replace(hrefFor(key), { scroll: false });
    });
  }

  if (tiers.length === 1 || !canBook) {
    return (
      <>
        {tiers.map((tier) => (
          <Badge
            key={tier.key}
            variant={tier.key === activeKey && tiers.length > 1 ? "default" : "outline"}
            className="tabular-nums"
          >
            Suất {formatVnd(tier.priceVnd)}
          </Badge>
        ))}
      </>
    );
  }

  return (
    <div role="group" aria-label="Chọn suất" className="flex flex-wrap items-center gap-1.5">
      {tiers.map((tier) => {
        const isActive = tier.key === activeKey;
        return (
          <button
            key={tier.key}
            type="button"
            aria-pressed={isActive}
            aria-label={`Chọn suất ${formatVnd(tier.priceVnd)} — ${tier.composition}`}
            disabled={isPending}
            onClick={() => choose(tier.key)}
            className="rounded-full disabled:opacity-60"
          >
            <Badge
              variant={isActive ? "default" : "outline"}
              className={`gap-1 tabular-nums transition-colors ${
                isActive ? "" : "hover:bg-accent cursor-pointer"
              }`}
            >
              {isPending && !isActive ? (
                <Loader2 className="size-3 animate-spin" aria-hidden />
              ) : isActive ? (
                <Check className="size-3" aria-hidden />
              ) : null}
              Suất {formatVnd(tier.priceVnd)}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
