/**
 * Lì xì may mắn — the rules, with no database in sight so both the server and
 * the envelope on screen can import them.
 *
 * An envelope is opened once per person (per round: only the admin's reset
 * wipes every envelope — turning the feature off keeps them) and takes a percentage off that
 * person's whole bill for the day they opened it — food, suất and ship. The
 * quán's bill is untouched; the discount is the admin's gift. The amount
 * itself is computed in `day-discount.ts`, together with the birthday's.
 */

export type LuckyPercent = 5 | 10 | 20;

/**
 * The odds, out of 100. 20% is the rare one — about one person in twenty.
 * Weights must sum to 100: `drawLuckyPercent` reads a roll of 0–99 against them.
 */
export const LUCKY_ODDS: readonly { percent: LuckyPercent; weight: number }[] = [
  { percent: 5, weight: 65 },
  { percent: 10, weight: 30 },
  { percent: 20, weight: 5 },
];

/**
 * Which prize a roll lands on. The roll comes from the server's
 * `crypto.randomInt(100)` — never from the browser, which could pick its own.
 */
export function drawLuckyPercent(roll: number): LuckyPercent {
  let threshold = 0;
  for (const { percent, weight } of LUCKY_ODDS) {
    threshold += weight;
    if (roll < threshold) return percent;
  }
  // Unreachable while the weights sum to 100; the common prize if they drift.
  return LUCKY_ODDS[0].percent;
}
