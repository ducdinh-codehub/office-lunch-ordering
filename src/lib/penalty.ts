/**
 * Đá penalty — the shootout itself, with no 3D in sight.
 *
 * Everyone still in takes one kick per round, keeper being someone else
 * still in. A miss knocks you out — unless nobody in the round scored, in
 * which case nobody goes and the round is taken again. The last one standing
 * wins. As with the race, the whole shootout is drawn before the first kick
 * and the pitch only reveals it; just for fun, nothing here touches a bill.
 *
 * About half the kicks end some ridiculous way (a dog, a pigeon, VAR). Each
 * silly ending gets rarer once it has happened, so a long shootout keeps
 * finding new ones.
 */

import { secureRandom } from "@/lib/dino-race";

export const OUTCOMES = {
  // The football ones.
  corner: { goal: true, weight: 22, silly: false },
  save: { goal: false, weight: 10, silly: false },
  wide: { goal: false, weight: 4, silly: false },
  over: { goal: false, weight: 4, silly: false },
  "post-out": { goal: false, weight: 3, silly: false },
  "post-in": { goal: true, weight: 3, silly: false },
  // The ridiculous ones.
  panenka: { goal: true, weight: 4, silly: true },
  "panenka-caught": { goal: false, weight: 3, silly: true },
  whiff: { goal: false, weight: 3, silly: true },
  shoe: { goal: false, weight: 3, silly: true },
  dog: { goal: false, weight: 3, silly: true },
  pigeon: { goal: true, weight: 3, silly: true },
  pop: { goal: false, weight: 3, silly: true },
  sleepy: { goal: true, weight: 3, silly: true },
  face: { goal: false, weight: 3, silly: true },
  rocket: { goal: true, weight: 3, silly: true },
  pinball: { goal: true, weight: 3, silly: true },
  boomerang: { goal: false, weight: 2, silly: true },
  clones: { goal: false, weight: 3, silly: true },
  "var-cancel": { goal: false, weight: 3, silly: true },
  "var-award": { goal: true, weight: 3, silly: true },
  // A fan on the pitch: runs off with the ball, or barges the shooter and
  // takes the kick himself — which the referee, somehow, allows.
  "hooligan-steal": { goal: false, weight: 3, silly: true },
  "hooligan-shoot": { goal: true, weight: 3, silly: true },
} as const;

export type Outcome = keyof typeof OUTCOMES;

/** How the shooter gets to the ball. Only a look: it never changes the kick. */
export type RunUp = "normal" | "moonwalk" | "long" | "stutter";

/** Why VAR changed its mind. None of these are rules. */
export const VAR_REASONS = [
  "Giày sai màu",
  "Ăn mừng quá sớm",
  "Quên chào khán giả",
  "Bóng không đủ tròn",
  "Thủ môn cười đểu",
  "Cỏ mọc sai hướng",
  "Trọng tài chưa ăn trưa",
  "Tóc quá đẹp",
  "Việt vị… ở phút 0",
  "Chạy đà quá ngầu",
] as const;

export type Kick = {
  round: number;
  shooter: number;
  keeper: number;
  outcome: Outcome;
  /** Whether it counts, after VAR. */
  goal: boolean;
  /** -1 or 1: which side the shooter aims for, from behind the shooter. */
  side: -1 | 1;
  /** 0–1: how high, where the outcome aims for a corner. */
  height: number;
  runUp: RunUp;
  /** For the VAR outcomes. */
  varReason?: string;
};

export type Round = {
  round: number;
  /** Who shot, in order. */
  shooters: number[];
  /** Who went out at the end of it — empty when nobody scored and it is taken again. */
  eliminated: number[];
};

export type ShootoutPlan = {
  names: string[];
  kicks: Kick[];
  rounds: Round[];
  /** Indexes into `names`, champion first, then by how long they lasted. */
  ranking: number[];
  /** The round each player went out in; `null` for the champion. */
  outIn: (number | null)[];
  goals: number[];
};

/** A shootout that has gone on this long ends by lot: nobody wants round 40. */
const MAX_ROUNDS = 25;

export function planShootout(names: string[], random: () => number = secureRandom): ShootoutPlan {
  const weights = Object.fromEntries(
    Object.entries(OUTCOMES).map(([outcome, spec]) => [outcome, spec.weight as number]),
  ) as Record<Outcome, number>;
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];

  const drawOutcome = (): Outcome => {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let roll = random() * total;
    for (const [outcome, weight] of Object.entries(weights) as [Outcome, number][]) {
      roll -= weight;
      if (roll < 0) {
        if (OUTCOMES[outcome].silly) weights[outcome] = weight * 0.3;
        return outcome;
      }
    }
    return "corner";
  };

  // Shooting order is drawn once and kept, as in a real shootout.
  let alive = names.map((_, i) => i).sort(() => random() - 0.5);
  const kicks: Kick[] = [];
  const rounds: Round[] = [];
  const goals = names.map(() => 0);
  const outIn: (number | null)[] = names.map(() => null);
  const out: number[][] = [];

  for (let round = 1; alive.length > 1; round++) {
    let scorers: number[] = [];
    for (const shooter of alive) {
      const others = alive.filter((other) => other !== shooter);
      const outcome = drawOutcome();
      const goal = OUTCOMES[outcome].goal;
      const roll = random();
      kicks.push({
        round,
        shooter,
        keeper: pick(others),
        outcome,
        goal,
        side: random() < 0.5 ? -1 : 1,
        height: random(),
        runUp: roll < 0.72 ? "normal" : roll < 0.81 ? "moonwalk" : roll < 0.9 ? "long" : "stutter",
        varReason: outcome.startsWith("var") ? pick(VAR_REASONS) : undefined,
      });
      if (goal) {
        scorers.push(shooter);
        goals[shooter]++;
      }
    }

    if (round >= MAX_ROUNDS && scorers.length !== 1) scorers = [pick(scorers.length ? scorers : alive)];
    const eliminated = scorers.length === 0 ? [] : alive.filter((player) => !scorers.includes(player));
    rounds.push({ round, shooters: [...alive], eliminated });
    for (const player of eliminated) outIn[player] = round;
    if (eliminated.length) out.push(eliminated);
    if (scorers.length) alive = alive.filter((player) => scorers.includes(player));
  }

  // Champion, then whoever went out last, and so on back to round one.
  const ranking = [...alive, ...out.reverse().flat()];
  return { names, kicks, rounds, ranking, outIn, goals };
}
