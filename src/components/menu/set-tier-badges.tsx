"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
 * On a day with two, tapping a badge is how a diner says which one they want:
 * the choice rides in the `suat` query parameter, so the server re-renders the
 * dish sections with that suất's quotas and nothing has to be mirrored in client
 * state. A day with a single suất has nothing to choose, so its badge stays a
 * plain label.
 */
export function SetTierBadges({
  tiers,
  activeKey,
}: {
  tiers: TierChoice[];
  activeKey: SetTierKey | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (tiers.length === 0) return null;

  const hrefFor = (key: SetTierKey) => {
    // Keep whatever else is in the URL — the admin ordering for someone else is
    // identified by `for`, and losing it would drop them back to their own menu.
    const next = new URLSearchParams(searchParams.toString());
    next.set("suat", key);
    return `${pathname}?${next.toString()}`;
  };

  if (tiers.length === 1) {
    const [only] = tiers;
    return (
      <Badge variant="outline" className="tabular-nums">
        Suất {formatVnd(only.priceVnd)}
      </Badge>
    );
  }

  return (
    <div role="group" aria-label="Chọn suất" className="flex flex-wrap items-center gap-1.5">
      {tiers.map((tier) => {
        const isActive = tier.key === activeKey;
        return (
          <Link
            key={tier.key}
            href={hrefFor(tier.key)}
            replace
            scroll={false}
            aria-current={isActive ? "true" : undefined}
            aria-label={`Chọn suất ${formatVnd(tier.priceVnd)} — ${tier.composition}`}
            className="rounded-full"
          >
            <Badge
              variant={isActive ? "default" : "outline"}
              className={`cursor-pointer gap-1 tabular-nums transition-colors ${
                isActive ? "" : "hover:bg-accent"
              }`}
            >
              {isActive && <Check className="size-3" aria-hidden />}
              Suất {formatVnd(tier.priceVnd)}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
