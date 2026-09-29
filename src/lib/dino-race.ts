/**
 * Đua khủng long — the race itself, with no canvas in sight.
 *
 * A race is planned in full before the first frame. Every runner gets a pace
 * that wanders in quarter-second steps, and on top of it the race throws
 * surprises: turbo bursts that favour whoever is behind (a 🚀 for last place),
 * and stumbles that favour whoever is ahead — so a lead is never safe and the
 * pack stays close. The course is then sized so the first runner to get
 * **all the way across** the line does so exactly when the chosen time runs
 * out; the others keep running and are placed by when they cross. The winner
 * is known the instant the race starts — the animation only reveals it.
 *
 * Just for fun: nothing here touches a bill. It runs in the browser of whoever
 * starts it, so it is a picker for a shared screen, not a draw anyone else can
 * audit.
 */

export const RACE_MIN_RUNNERS = 2;
export const RACE_MAX_RUNNERS = 30;
export const RUNNER_NAME_MAX = 30;
export const RACE_MIN_SECONDS = 5;
export const RACE_MAX_SECONDS = 120;
export const RACE_PRESET_SECONDS = [10, 20, 30, 60] as const;

/** How long a pace holds before it wanders again. Every duration is whole seconds, so a multiple of it. */
export const STEP_MS = 250;
/** How far a pace may drift in one step, and the band it stays in. */
const DRIFT = 0.3;
const PACE_MIN = 0.6;
const PACE_MAX = 1.4;
/** Nothing happens in the first second: everyone gets away clean. */
const QUIET_STEPS = 4;
/** After an event, a runner is left alone for this many steps. */
const COOLDOWN_STEPS = 6;
/** Two finishers closer than this call for the photo-finish replay. */
export const PHOTO_FINISH_MS = 300;

/**
 * What a runner is in the middle of. The last three only happen in a race
 * with weapons: winding up a throw, wearing a pie, and going over on a peel.
 */
export type RaceEventKind = "boost" | "rocket" | "stumble" | "throw" | "splat" | "slip";

export type RaceEvent = {
  runner: number;
  kind: RaceEventKind;
  startMs: number;
  endMs: number;
};

const EVENT_EFFECT: Record<RaceEventKind, { pace: number; steps: [number, number] }> = {
  boost: { pace: 1.9, steps: [4, 6] },
  rocket: { pace: 2.6, steps: [5, 7] },
  stumble: { pace: 0.08, steps: [3, 5] },
  throw: { pace: 0.85, steps: [2, 2] },
  splat: { pace: 0.1, steps: [4, 6] },
  slip: { pace: 0.05, steps: [4, 5] },
};

/** How long a pie is in the air, in steps; a peel lands in one. */
const PIE_FLIGHT_STEPS = 2;
/** The share of pies the target sees coming and ducks, and of peels hopped over. */
const DODGE_CHANCE = 0.25;
const HOP_CHANCE = 0.2;

export type Weapon = "pie" | "banana";

/**
 * One use of a weapon. A pie is thrown at whoever is just ahead and lands
 * `PIE_FLIGHT_STEPS` later — unless they duck, or are already home. A peel is
 * tossed into the lane of whoever is just behind, part-way back to them, and
 * trips them when they reach it.
 */
export type Attack = {
  weapon: Weapon;
  from: number;
  to: number;
  /** When it leaves the thrower's hand. */
  atMs: number;
  /**
   * When it lands in the target's face, or they reach the peel; `null` if it
   * never did. A peel reached can still be hopped over — see `dodged`.
   */
  hitMs: number | null;
  /** A pie seen coming and ducked, or a peel hopped over: no harm done. */
  dodged: boolean;
  /** Where the peel lies, as a fraction of the course. */
  at: number;
};

export type Runner = {
  name: string;
  /**
   * Fraction of the course covered at the end of each step, from 0; 1 is the
   * whole body past the finish line. Runs past the chosen time, until this
   * runner has crossed too (or the simulation gave up on them).
   */
  checkpoints: number[];
  /** When they got across, ms from the start — `null` if they never did. */
  finishMs: number | null;
};

export type RacePlan = {
  durationMs: number;
  runners: Runner[];
  /** Indexes into `runners`, first place first. */
  ranking: number[];
  events: RaceEvent[];
  attacks: Attack[];
  /** Who led from when — the first entry is whoever leads off the line. */
  leadChanges: { atMs: number; runner: number }[];
  /** First and second crossed within `PHOTO_FINISH_MS`. */
  photoFinish: boolean;
};

/** A float in [0, 1) from the platform's CSPRNG — Math.random is fine too, but this costs nothing. */
export function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
}

export function clampSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return RACE_PRESET_SECONDS[1];
  return Math.min(RACE_MAX_SECONDS, Math.max(RACE_MIN_SECONDS, Math.round(seconds)));
}

/** Same name, whatever the case or spacing — a list may not hold it twice. */
export function sameRunnerName(a: string, b: string): boolean {
  const norm = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");
  return norm(a) === norm(b);
}

export function planRace(
  names: string[],
  durationSeconds: number,
  { weapons = false }: { weapons?: boolean } = {},
  random: () => number = secureRandom,
): RacePlan {
  const durationMs = clampSeconds(durationSeconds) * 1000;
  const steps = durationMs / STEP_MS;
  const count = names.length;
  // Room for the slowest to get home after the winner; anyone still out after
  // this is placed by how far they got.
  const maxSteps = steps * 3 + 40;

  // About one surprise every couple of seconds across the whole field, and
  // never more than one every ~8 s for any one runner.
  const eventChance = Math.min(0.03, 0.12 / count);

  const pace = names.map(() => 0.85 + random() * 0.3);
  const distance: number[][] = names.map(() => [0]);
  const active: ({ event: RaceEvent; until: number } | null)[] = names.map(() => null);
  const calmUntil = names.map(() => QUIET_STEPS);
  const events: RaceEvent[] = [];
  let finishLine = Infinity;

  // Weapons in flight: a pie lands on a given step, a peel waits to be stepped on.
  const attacks: Attack[] = [];
  const pies: { attack: Attack; lands: number }[] = [];
  const peels: { attack: Attack; at: number; from: number }[] = [];

  const begin = (runner: number, kind: RaceEventKind, step: number) => {
    const [min, max] = EVENT_EFFECT[kind].steps;
    const length = min + Math.floor(random() * (max - min + 1));
    // Being hit cuts short whatever the runner was doing — a burst included.
    const current = active[runner];
    if (current) current.event.endMs = Math.min(current.event.endMs, step * STEP_MS);
    const event = { runner, kind, startMs: step * STEP_MS, endMs: (step + length) * STEP_MS };
    events.push(event);
    active[runner] = { event, until: step + length };
    calmUntil[runner] = Math.max(calmUntil[runner], step + length + COOLDOWN_STEPS);
  };

  for (let step = 0; step < maxSteps; step++) {
    const now = distance.map((track) => track[step]);
    if (step >= steps && now.every((d) => d >= finishLine)) break;

    // 0 for the leader, 1 for last place.
    const order = now.map((_, i) => i).sort((a, b) => now[b] - now[a]);
    const behind: number[] = [];
    order.forEach((runner, place) => (behind[runner] = count > 1 ? place / (count - 1) : 0));

    for (let i = 0; i < count; i++) if (active[i] && active[i]!.until <= step) active[i] = null;
    const home = (runner: number) => now[runner] >= finishLine;

    // Weapons land before anyone decides anything this step.
    for (const pie of pies.filter((pie) => pie.lands === step)) {
      const { attack } = pie;
      if (home(attack.to)) continue;
      if (random() < DODGE_CHANCE) {
        attack.dodged = true;
        continue;
      }
      attack.hitMs = step * STEP_MS;
      begin(attack.to, "splat", step);
    }
    for (let p = peels.length - 1; p >= 0; p--) {
      const peel = peels[p];
      if (step <= peel.from || home(peel.attack.to) || now[peel.attack.to] < peel.at) continue;
      peel.attack.hitMs = step * STEP_MS;
      if (random() < HOP_CHANCE) peel.attack.dodged = true;
      else begin(peel.attack.to, "slip", step);
      peels.splice(p, 1);
    }

    for (let i = 0; i < count; i++) {
      const crossed = home(i);

      if (!active[i] && !crossed && step >= calmUntil[i]) {
        const roll = random();
        const boostChance = eventChance * (0.4 + 1.6 * behind[i]);
        const stumbleChance = eventChance * (0.3 + 1.2 * (1 - behind[i]));
        const attackChance = weapons ? eventChance * 1.8 : 0;
        if (roll < boostChance) begin(i, behind[i] === 1 && count > 2 && random() < 0.6 ? "rocket" : "boost", step);
        else if (roll < boostChance + stumbleChance) begin(i, "stumble", step);
        else if (roll < boostChance + stumbleChance + attackChance) {
          // Pies go forward, peels go back: the leader can only drop a peel,
          // last place can only throw a pie, and the middle mostly throws.
          const place = order.indexOf(i);
          const ahead = order.slice(0, place).reverse().find((other) => !home(other));
          const after = order.slice(place + 1).find((other) => !home(other));
          const weapon: Weapon | null =
            ahead !== undefined && (after === undefined || random() < 0.6)
              ? "pie"
              : after !== undefined
                ? "banana"
                : null;
          if (weapon) {
            const to = weapon === "pie" ? ahead! : after!;
            const attack: Attack = {
              weapon,
              from: i,
              to,
              atMs: step * STEP_MS,
              hitMs: null,
              dodged: false,
              // Part-way from the target to the thrower, so it is in front of them.
              at: now[to] + (now[i] - now[to]) * (0.35 + random() * 0.3),
            };
            attacks.push(attack);
            begin(i, "throw", step);
            if (weapon === "pie") pies.push({ attack, lands: step + PIE_FLIGHT_STEPS });
            else peels.push({ attack, at: attack.at, from: step });
          }
        }
      }

      pace[i] = Math.min(PACE_MAX, Math.max(PACE_MIN, pace[i] + (random() - 0.5) * DRIFT));
      // A gentle pull towards the pack keeps the race close without deciding it.
      const pull = 1 + 0.1 * (behind[i] - 0.5);
      const effect = active[i] ? EVENT_EFFECT[active[i]!.event.kind].pace : 1;
      distance[i].push(now[i] + pace[i] * pull * effect * STEP_MS);
    }

    // The course ends wherever the leader is when the time runs out.
    if (step + 1 === steps) finishLine = Math.max(...distance.map((track) => track[steps]));
  }

  // Events planned for after someone crossed are dropped by the loop; ones
  // left dangling past the end of the simulation are harmless.
  const finishStepOf = (track: number[]) => track.findIndex((d) => d >= finishLine);
  const runners: Runner[] = names.map((name, i) => {
    const track = distance[i];
    const at = finishStepOf(track);
    let finishMs: number | null = null;
    if (at > 0) {
      const before = track[at - 1];
      finishMs = (at - 1 + (finishLine - before) / (track[at] - before)) * STEP_MS;
    }
    return { name, checkpoints: track.map((d) => d / finishLine), finishMs };
  });
  for (const attack of attacks) attack.at /= finishLine;

  const ranking = runners
    .map((runner, index) => ({ index, runner }))
    .sort((a, b) => {
      const fa = a.runner.finishMs;
      const fb = b.runner.finishMs;
      if (fa !== null && fb !== null) return fa - fb;
      if (fa !== null) return -1;
      if (fb !== null) return 1;
      return b.runner.checkpoints.at(-1)! - a.runner.checkpoints.at(-1)!;
    })
    .map((entry) => entry.index);

  // Lead changes, step by step, ignoring anyone already home: a leader has to
  // hold on for half a second to count, so a nose-to-nose tussle is one call
  // and not a flicker.
  const leadChanges: RacePlan["leadChanges"] = [];
  let leader = -1;
  let candidate = -1;
  let since = 0;
  for (let step = 1; step <= steps; step++) {
    let best = 0;
    for (let i = 1; i < count; i++) if (runners[i].checkpoints[step] > runners[best].checkpoints[step]) best = i;
    if (best !== candidate) {
      candidate = best;
      since = step;
    }
    if (candidate !== leader && (step - since >= 2 || leader === -1)) {
      leader = candidate;
      leadChanges.push({ atMs: since * STEP_MS, runner: leader });
    }
  }

  const [first, second] = ranking.map((index) => runners[index].finishMs);
  const photoFinish = first !== null && second !== null && second! - first! < PHOTO_FINISH_MS;

  return { durationMs, runners, ranking, events, attacks, leadChanges, photoFinish };
}

/** Where a runner is, as a fraction of the course, `elapsedMs` after the start. May pass 1. */
export function progressAt(runner: Runner, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const last = runner.checkpoints.length - 1;
  const step = Math.floor(elapsedMs / STEP_MS);
  if (step >= last) {
    // Past the end of the simulation: carry on at the last step's pace.
    const pace = last > 0 ? runner.checkpoints[last] - runner.checkpoints[last - 1] : 0;
    return runner.checkpoints[last] + (pace * (elapsedMs - last * STEP_MS)) / STEP_MS;
  }
  const within = (elapsedMs - step * STEP_MS) / STEP_MS;
  const from = runner.checkpoints[step];
  return from + (runner.checkpoints[step + 1] - from) * within;
}

/** The event a runner is in the middle of, if any. */
export function eventAt(plan: RacePlan, runner: number, elapsedMs: number): RaceEvent | null {
  for (const event of plan.events) {
    if (event.runner === runner && event.startMs <= elapsedMs && elapsedMs < event.endMs) return event;
  }
  return null;
}

/** When a pie thrown at `atMs` reaches its target. */
export function pieLandsMs(attack: Attack): number {
  return attack.atMs + PIE_FLIGHT_STEPS * STEP_MS;
}
