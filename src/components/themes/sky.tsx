import type { CSSProperties } from "react";

/*
 * Sky pieces the welcome backdrops share: thin flat clouds and birds that
 * drift across the screen (`.sky-drift`, with `--drift-duration` and
 * `--drift-delay`), the birds flapping as they go (`.sky-flap`). The
 * animations live in globals.css.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

export function Cloud({ width }: { width: number }) {
  return (
    <svg width={width} height={width * 0.14} viewBox="0 0 300 42">
      <path
        d="M8 36 C30 22 70 22 100 26 C122 12 176 10 206 22 C236 16 278 22 294 36 Z"
        className="fill-white dark:fill-slate-400/40"
      />
    </svg>
  );
}

export function Bird({ size }: { size: number }) {
  return (
    <svg className="sky-flap" width={size} height={size * 0.5} viewBox="0 0 40 20">
      <path
        d="M2 12 Q10 4 20 12 Q30 4 38 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Where a drifting piece crosses, how long it takes, and how far along it starts. */
export function driftStyle(top: string, duration: number, delay: number): Vars {
  return { top, "--drift-duration": `${duration}s`, "--drift-delay": `${delay}s` };
}
