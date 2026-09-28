import type { CSSProperties } from "react";

import { FoodLayer } from "./food-layer";

/*
 * Halloween backdrop: a pale moon in a soft pumpkin dusk (no violet — it was
 * tiring to read against), bats flapping across it, bats flapping across it,
 * ghosts drifting up the screen, a spider bobbing on its thread over a cobweb,
 * jack-o'-lanterns flickering in the corner, and candy floating about among
 * the shared `FoodLayer`. Purely
 * decorative: fixed behind the content, no pointer events, hidden from screen
 * readers.
 *
 * Every position and delay is written out rather than randomised so the server
 * and client render the same markup. Delays are negative so the night is
 * already busy on first paint. The animations live in globals.css under
 * `.halloween-backdrop`.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

/** Just under the app shell's frosted `h-14` header, which blurs what is behind. */
const HEADER = "3.5rem";

/**
 * A few bats on slow, lazy crossings — enough to set the scene, not so many
 * or so quick that the page feels busy. Delays spread them a third of a lap
 * apart, so they never bunch up.
 */
const bats: { top: string; size: number; duration: number; delay: number }[] = [
  { top: "16%", size: 60, duration: 48, delay: -4 },
  { top: "30%", size: 46, duration: 55, delay: -22 },
  { top: "11%", size: 40, duration: 42, delay: -33 },
];

/** Ghosts drift up slowly — about a minute or more to cross the screen. */
const ghosts: { left: string; size: number; duration: number; delay: number; rest: string }[] = [
  { left: "7%", size: 44, duration: 62, delay: -16, rest: "-45vh" },
  { left: "31%", size: 32, duration: 74, delay: -45, rest: "-70vh" },
  { left: "68%", size: 38, duration: 68, delay: -6, rest: "-30vh" },
  { left: "90%", size: 30, duration: 80, delay: -58, rest: "-60vh" },
];

/** `phone` keeps one on narrow screens, as in the shared food layer. */
const candy: {
  top: string;
  left: string;
  size: string;
  emoji: string;
  drift: string;
  phone?: true;
}[] = [
  { top: "46%", left: "4%", size: "1.75rem", emoji: "🍬", drift: "animate-drift-a", phone: true },
  { top: "58%", left: "86%", size: "1.75rem", emoji: "🍭", drift: "animate-drift-b" },
  { top: "74%", left: "36%", size: "1.5rem", emoji: "🍫", drift: "animate-drift-c", phone: true },
  { top: "34%", left: "58%", size: "1.5rem", emoji: "🍎", drift: "animate-drift-a" },
  { top: "86%", left: "64%", size: "1.5rem", emoji: "🧁", drift: "animate-drift-c" },
];

/** Pumpkins at the bottom-left — the donate button owns the bottom-right. */
const pumpkins: { left: string; bottom: string; width: string; delay: number }[] = [
  { left: "0.75rem", bottom: "1rem", width: "4.5rem", delay: 0 },
  { left: "4.75rem", bottom: "0.5rem", width: "3.25rem", delay: -1.1 },
];

/** Where the cobweb's spokes end, fanning out from the top-left corner. */
const WEB_SPOKES = [
  [100, 12],
  [86, 52],
  [52, 86],
  [12, 100],
] as const;

/**
 * One ring of the web at `t` of the way out: a strand between each pair of
 * neighbouring spokes, sagging back towards the corner the way silk does.
 */
function webRing(t: number): string {
  return WEB_SPOKES.slice(0, -1)
    .map(([x1, y1], i) => {
      const [x2, y2] = WEB_SPOKES[i + 1];
      const sag = 0.82;
      const cx = ((x1 + x2) / 2) * t * sag;
      const cy = ((y1 + y2) / 2) * t * sag;
      return `${i === 0 ? `M${x1 * t} ${y1 * t}` : ""} Q${cx} ${cy} ${x2 * t} ${y2 * t}`;
    })
    .join(" ");
}

function Bat({ size }: { size: number }) {
  return (
    <svg className="halloween-flap" width={size} height={size * 0.5} viewBox="0 0 100 50">
      <path
        d="M50 18 C46 10 42 10 40 16 C34 6 22 4 8 10 C16 14 18 20 16 28 C22 22 28 24 32 30 C36 24 42 24 46 30 L50 36 L54 30 C58 24 64 24 68 30 C72 24 78 22 84 28 C82 20 84 14 92 10 C78 4 66 6 60 16 C58 10 54 10 50 18 Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Ghost({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 80 100">
      <path
        d="M40 4 C18 4 8 22 8 42 V88 L18 80 L28 90 L40 80 L52 90 L62 80 L72 88 V42 C72 22 62 4 40 4 Z"
        className="fill-white dark:fill-slate-100"
        stroke="#cbd5e1"
        strokeWidth="2"
      />
      <ellipse cx="30" cy="40" rx="5" ry="7" fill="#334155" />
      <ellipse cx="50" cy="40" rx="5" ry="7" fill="#334155" />
      <ellipse cx="40" cy="58" rx="6" ry="8" fill="#334155" opacity="0.85" />
    </svg>
  );
}

function JackOLantern({ className, delay }: { className?: string; delay: number }) {
  return (
    <svg className={className} viewBox="0 0 100 90">
      <path d="M48 14 C48 6 54 2 60 4 C56 8 54 12 54 16 Z" fill="#4d7c0f" />
      <path d="M56 8 C64 2 74 6 72 12 C66 10 62 10 58 12 Z" fill="#65a30d" />
      <ellipse cx="30" cy="52" rx="24" ry="30" fill="#c2410c" />
      <ellipse cx="70" cy="52" rx="24" ry="30" fill="#c2410c" />
      <ellipse cx="50" cy="52" rx="26" ry="34" fill="#ea580c" />
      <path d="M50 20 C44 40 44 66 50 86" fill="none" stroke="#9a3412" strokeWidth="1.5" />
      {/* The face is lit from inside; the flicker animates just this group. */}
      <g className="halloween-flicker" style={{ animationDelay: `${delay}s` }} fill="#fde047">
        <path d="M28 40 L38 30 L42 44 Z" />
        <path d="M72 40 L62 30 L58 44 Z" />
        <path d="M46 50 L50 44 L54 50 Z" />
        <path d="M24 58 C34 74 66 74 76 58 L68 62 L64 56 L58 64 L50 58 L42 64 L36 56 L32 62 Z" />
      </g>
    </svg>
  );
}

export function HalloweenBackdrop() {
  return (
    <div
      aria-hidden
      className="halloween-backdrop pointer-events-none fixed inset-0 m-0 -z-10 overflow-hidden"
    >
      {/* A soft pumpkin dusk by day; a neutral charcoal night by night — warm
          and low-contrast, easy on the eyes. Warm-grey fog at the floor. */}
      <div className="absolute inset-x-0 top-0 h-[65vh] bg-gradient-to-b from-orange-100/80 via-amber-50/50 to-transparent dark:from-stone-900/85 dark:via-stone-950/50" />
      <div className="halloween-fog absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-stone-200/60 to-transparent dark:from-stone-800/40" />

      {/* The moon, with a faint cloud band across it. */}
      <div className="halloween-moon absolute top-20 -right-10 size-44 rounded-full sm:top-24 sm:right-16 sm:size-56">
        <span className="absolute top-[28%] left-[22%] size-7 rounded-full bg-orange-200/50" />
        <span className="absolute top-[58%] left-[56%] size-10 rounded-full bg-orange-200/40" />
      </div>

      {/* Cobweb in the top-left corner and its spider, bobbing on a thread. */}
      <svg
        className="absolute left-0 w-36 text-slate-400/60 sm:w-44 dark:text-slate-300/40"
        style={{ top: HEADER }}
        viewBox="0 0 100 100"
      >
        <g fill="none" stroke="currentColor" strokeWidth="0.8">
          {WEB_SPOKES.map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M0 0 L${x} ${y}`} />
          ))}
          {[0.22, 0.42, 0.62, 0.82].map((t) => (
            <path key={t} d={webRing(t)} />
          ))}
        </g>
      </svg>
      {/* Desktop only: on a phone there is no margin, and it hangs on the heading. */}
      <div className="halloween-spider absolute left-36 hidden sm:block" style={{ top: HEADER }}>
        <div className="mx-auto h-24 w-px bg-slate-500/80 dark:bg-slate-300/60" />
        <svg className="-mt-1 w-7 text-slate-800 dark:text-slate-200" viewBox="0 0 40 36">
          <g stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round">
            <path d="M14 16 L4 8 M14 19 L2 18 M14 22 L4 30 M15 25 L8 34" />
            <path d="M26 16 L36 8 M26 19 L38 18 M26 22 L36 30 M25 25 L32 34" />
          </g>
          <ellipse cx="20" cy="22" rx="8" ry="9" fill="currentColor" />
          <circle cx="20" cy="11" r="5" fill="currentColor" />
          <circle cx="18" cy="10" r="1.2" fill="#f97316" />
          <circle cx="22" cy="10" r="1.2" fill="#f97316" />
        </svg>
      </div>

      {bats.map((bat, i) => (
        <div
          key={`bat-${i}`}
          className="halloween-bat absolute left-0 text-slate-900/75 dark:text-slate-200/70"
          style={
            {
              top: bat.top,
              "--bat-duration": `${bat.duration}s`,
              "--bat-delay": `${bat.delay}s`,
            } as Vars
          }
        >
          <Bat size={bat.size} />
        </div>
      ))}

      {candy.map((treat, i) => (
        <span
          key={`candy-${i}`}
          className={`absolute opacity-25 dark:opacity-35 ${treat.drift} ${treat.phone ? "" : "hidden sm:block"}`}
          style={{ top: treat.top, left: treat.left, fontSize: treat.size }}
        >
          {treat.emoji}
        </span>
      ))}

      {ghosts.map((ghost, i) => (
        <div
          key={`ghost-${i}`}
          className="halloween-rise absolute -bottom-32"
          style={
            {
              left: ghost.left,
              "--rise-duration": `${ghost.duration}s`,
              "--rise-delay": `${ghost.delay}s`,
              "--rest-y": ghost.rest,
            } as Vars
          }
        >
          <div className="halloween-wobble" style={{ animationDelay: `${ghost.delay / 3}s` }}>
            <Ghost size={ghost.size} />
          </div>
        </div>
      ))}

      {/* The same food as the winter theme, among the candy. */}
      <FoodLayer />

      {pumpkins.map((pumpkin, i) => (
        <div
          key={`pumpkin-${i}`}
          className="halloween-pumpkin absolute"
          style={{ left: pumpkin.left, bottom: pumpkin.bottom, width: pumpkin.width }}
        >
          <JackOLantern className="block w-full" delay={pumpkin.delay} />
        </div>
      ))}
    </div>
  );
}
