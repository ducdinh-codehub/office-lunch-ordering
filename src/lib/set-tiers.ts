import type { MenuDay, SetTierKey } from "@/db/schema";

/** How many dishes from each set category — required by a tier, or picked by a diner. */
export type SetCounts = { main: number; side: number; veg: number };

export type SetTier = {
  key: SetTierKey;
  priceVnd: number;
  required: SetCounts;
};

/** The part of a menu day that defines what a suất is. */
export type SetTierFields = Pick<
  MenuDay,
  | "setPriceVnd"
  | "requiredMain"
  | "requiredSide"
  | "requiredVeg"
  | "altSetPriceVnd"
  | "altRequiredMain"
  | "altRequiredSide"
  | "altRequiredVeg"
>;

const dishCount = (counts: SetCounts) => counts.main + counts.side + counts.veg;

/**
 * The suất a day offers, cheapest first.
 *
 * Most days offer one. The second is opt-in and exists so a day can sell, say,
 * 1 món chính at 40.000 ₫ beside 2 at 50.000 ₫ — the diner picks a tier simply
 * by how many dishes they take. A tier asking for no dishes at all is not on
 * offer, which is how a day with `alt_required_* = 0` stays single-tier.
 */
export function setTiers(day: SetTierFields): SetTier[] {
  const candidates: SetTier[] = [
    {
      key: "full",
      priceVnd: day.setPriceVnd,
      required: { main: day.requiredMain, side: day.requiredSide, veg: day.requiredVeg },
    },
    {
      key: "alt",
      priceVnd: day.altSetPriceVnd,
      required: {
        main: day.altRequiredMain,
        side: day.altRequiredSide,
        veg: day.altRequiredVeg,
      },
    },
  ];

  return candidates
    .filter((tier) => dishCount(tier.required) > 0)
    .sort((a, b) => a.priceVnd - b.priceVnd);
}

/** True when the day sells a suất at all — as opposed to à-la-carte only. */
export function offersSet(day: SetTierFields): boolean {
  return setTiers(day).length > 0;
}

/**
 * The most dishes a diner may take from each category, across every tier.
 *
 * This is the cap the booking action enforces: with tiers of 1 and 2 món chính
 * a diner must be able to reach either, so the limit is the larger one.
 */
export function maxSetPicks(day: SetTierFields): SetCounts {
  return setTiers(day).reduce<SetCounts>(
    (max, tier) => ({
      main: Math.max(max.main, tier.required.main),
      side: Math.max(max.side, tier.required.side),
      veg: Math.max(max.veg, tier.required.veg),
    }),
    { main: 0, side: 0, veg: 0 },
  );
}

/**
 * The tier a selection completes, or null while it completes none.
 *
 * A tier is satisfied only by an exact match: picking 1 of 2 món chính is an
 * unfinished 50.000 ₫ suất, never a discounted one. Because `setTiers` is
 * sorted by price, two tiers with identical requirements resolve to the cheaper.
 */
export function resolveSetTier(day: SetTierFields, picked: SetCounts): SetTier | null {
  return (
    setTiers(day).find(
      (tier) =>
        picked.main === tier.required.main &&
        picked.side === tier.required.side &&
        picked.veg === tier.required.veg,
    ) ?? null
  );
}

/** What a diner still has to pick to complete `tier`. Negative means too many. */
export function missingFor(tier: SetTier, picked: SetCounts): SetCounts {
  return {
    main: tier.required.main - picked.main,
    side: tier.required.side - picked.side,
    veg: tier.required.veg - picked.veg,
  };
}

/**
 * Tiers still within reach — ones the diner can complete by picking more,
 * without giving anything up. Used to tell them what the next suất up costs.
 */
export function reachableTiers(day: SetTierFields, picked: SetCounts): SetTier[] {
  return setTiers(day).filter((tier) => {
    const missing = missingFor(tier, picked);
    return missing.main >= 0 && missing.side >= 0 && missing.veg >= 0;
  });
}

/** The `suat` query parameter, kept only when it names a real suất. */
export function parseSelectedTier(value: string | undefined): SetTierKey | null {
  return value === "full" || value === "alt" ? value : null;
}
