/**
 * Đua khủng long — the race itself, with no canvas in sight.
 *
 * A race is planned in full before the first frame: every runner gets a pace
 * that wanders up and down in half-second steps, and the whole field is then
 * scaled so the fastest crosses the line exactly when the chosen time runs
 * out. The winner is therefore known the instant the race starts — the
 * animation only reveals it — and the lead can still change hands right up to
 * the line, because paces are drawn independently.
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

/** How long a pace holds before it wanders again. */
const STEP_MS = 500;
/** How far a pace may drift in one step, and the band it stays in. */
const DRIFT = 0.5;
const PACE_MIN = 0.55;
const PACE_MAX = 1.45;

export type Runner = {
  name: string;
  /**
   * Fraction of the track covered at the end of each step, from 0. The last
   * entry is where they stand when the time is up: exactly 1 for the winner.
   */
  checkpoints: number[];
};

export type RacePlan = {
  durationMs: number;
  runners: Runner[];
  /** Indexes into `runners`, first place first. */
  ranking: number[];
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
  random: () => number = secureRandom,
): RacePlan {
  const durationMs = clampSeconds(durationSeconds) * 1000;
  const steps = Math.ceil(durationMs / STEP_MS);

  const raw = names.map((name) => {
    let pace = 0.8 + random() * 0.4;
    const checkpoints = [0];
    for (let step = 0; step < steps; step++) {
      pace = Math.min(PACE_MAX, Math.max(PACE_MIN, pace + (random() - 0.5) * DRIFT));
      // The last step is short when the duration is not a multiple of STEP_MS.
      const stepMs = Math.min(STEP_MS, durationMs - step * STEP_MS);
      checkpoints.push(checkpoints[step] + pace * stepMs);
    }
    return { name, checkpoints };
  });

  const best = Math.max(...raw.map((runner) => runner.checkpoints[steps]));
  const runners = raw.map((runner) => ({
    name: runner.name,
    checkpoints: runner.checkpoints.map((distance) => distance / best),
  }));
  const ranking = runners
    .map((runner, index) => ({ index, final: runner.checkpoints[steps] }))
    .sort((a, b) => b.final - a.final)
    .map((entry) => entry.index);

  return { durationMs, runners, ranking };
}

/** Where a runner is, as a fraction of the track, `elapsedMs` after the start. */
export function progressAt(runner: Runner, elapsedMs: number, durationMs: number): number {
  if (elapsedMs <= 0) return 0;
  const last = runner.checkpoints.length - 1;
  if (elapsedMs >= durationMs) return runner.checkpoints[last];
  const step = Math.floor(elapsedMs / STEP_MS);
  const within = (elapsedMs - step * STEP_MS) / Math.min(STEP_MS, durationMs - step * STEP_MS);
  const from = runner.checkpoints[step];
  const to = runner.checkpoints[Math.min(step + 1, last)];
  return from + (to - from) * within;
}
