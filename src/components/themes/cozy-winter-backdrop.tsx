import type { CSSProperties } from "react";

import { FoodLayer, type Treat } from "./food-layer";

/*
 * Cozy winter backdrop, in firelight: a string of fairy lights sagging across
 * the top, the gió mùa đông bắc — Hà Nội's northeast monsoon — gusting across
 * the screen and tumbling dry leaves along with it, a mug of cacao steaming in
 * the corner,
 * and food everywhere — the shared `FoodLayer`: phở, chả giò, lẩu and the
 * winter street food of Hà Nội hovering faintly, while cups and bowls rise up
 * the screen like released balloons. Purely decorative: fixed behind the
 * content, no pointer events, hidden from screen readers.
 *
 * Every position and delay is written out rather than randomised so the server
 * and client render the same markup. Delays are negative so the wind is
 * already blowing on first paint instead of every gust starting at once. The animations themselves live in globals.css under `.winter-backdrop`.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

/**
 * Where the light string is pinned: just under the app shell's `h-14` header,
 * which is frosted glass — anything behind it is blurred to nothing.
 */
const WIRE_TOP = "3.5rem";

/** How far the light string sags below its two anchors, in px. */
const WIRE_SAG = 26;
/** Where the wire is pinned — each span between two pins sags on its own. */
const WIRE_PINS = [0, 0.34, 0.67, 1];

// Old-fashioned warm bulbs — honey, amber, ember and cream — like a string
// hung in a window on a cold evening.
const BULB_COLORS = ["#fcd34d", "#fb923c", "#fde68a", "#f87171", "#fdba74"];

/** Bulbs along the wire, as a fraction of the screen width. */
const bulbs = [
  0.04, 0.1, 0.17, 0.24, 0.3, 0.38, 0.45, 0.52, 0.59, 0.63, 0.71, 0.78, 0.85, 0.92, 0.97,
];

/** Height of the wire at `x`: a parabola between whichever two pins surround it. */
function wireDrop(x: number): number {
  const i = WIRE_PINS.findIndex((pin, index) => x >= pin && x <= WIRE_PINS[index + 1]);
  const start = WIRE_PINS[i];
  const end = WIRE_PINS[i + 1];
  const t = (x - start) / (end - start);
  return 4 * WIRE_SAG * t * (1 - t);
}

/** The wire's SVG path in a 1000-wide viewBox, one quadratic curve per span. */
const wirePath = WIRE_PINS.slice(0, -1)
  .map((pin, i) => {
    const end = WIRE_PINS[i + 1];
    // A quadratic's control point sits twice as deep as the curve's lowest point.
    const mid = ((pin + end) / 2) * 1000;
    return `${i === 0 ? `M${pin * 1000} 2` : ""} Q${mid} ${2 + WIRE_SAG * 2} ${end * 1000} 2`;
  })
  .join(" ");

/**
 * Streaks of wind sweeping left to right. Each sweeps across in the first half
 * of its cycle and rests for the second, so gusts come and go rather than
 * streaming constantly. `curl` ends the streak in a little swirl.
 */
const gusts: {
  top: string;
  width: number;
  duration: number;
  delay: number;
  curl?: true;
  /** Where it holds, faintly, when motion is reduced. */
  rest: string;
}[] = [
  { top: "14%", width: 380, duration: 28, delay: -4, curl: true, rest: "8vw" },
  { top: "27%", width: 300, duration: 36, delay: -22, rest: "56vw" },
  { top: "41%", width: 420, duration: 32, delay: -12, curl: true, rest: "62vw" },
  { top: "56%", width: 280, duration: 40, delay: -30, rest: "4vw" },
  { top: "68%", width: 360, duration: 30, delay: -18, curl: true, rest: "48vw" },
  { top: "82%", width: 320, duration: 38, delay: -2, rest: "70vw" },
];

/** Dry leaves carried on the wind, tumbling as they go. */
const leaves: {
  top: string;
  size: number;
  color: string;
  duration: number;
  delay: number;
  rest: string;
}[] = [
  { top: "20%", size: 32, color: "#b45309", duration: 38, delay: -8, rest: "30vw" },
  { top: "36%", size: 24, color: "#d97706", duration: 46, delay: -30, rest: "74vw" },
  { top: "52%", size: 28, color: "#a16207", duration: 42, delay: -18, rest: "12vw" },
  { top: "66%", size: 22, color: "#ca8a04", duration: 50, delay: -38, rest: "58vw" },
  { top: "78%", size: 26, color: "#c2410c", duration: 40, delay: -2, rest: "86vw" },
];

/** A streak in a 400 × 60 box; the curled ones loop back on themselves at the end. */
const GUST_PATH = "M0 34 C80 22 160 44 240 30 S360 24 400 30";
const GUST_CURL_PATH =
  "M0 36 C70 24 140 46 210 32 C260 22 300 26 318 34 C336 44 330 60 312 56 C296 52 300 36 316 36";

/** Not food, but the season: it floats with the food layer's treats. */
const winterWear: Treat[] = [
  { top: "86%", left: "70%", size: "1.5rem", emoji: "🧣", drift: "animate-drift-a" },
];

/** The three wisps above the mug, each rising on its own beat. */
const steam = [
  { d: "M40 34 C34 26 46 20 40 12 C35 6 42 2 40 -4", delay: 0 },
  { d: "M50 34 C56 26 44 18 50 10 C55 4 48 0 50 -6", delay: -1.3 },
  { d: "M60 34 C54 27 66 21 60 13 C56 7 62 3 60 -3", delay: -2.6 },
];

export function CozyWinterBackdrop() {
  return (
    <div
      aria-hidden
      className="winter-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Lamplight by day — peach and honey; by night a cocoa-dark room with
          embers glowing low, as if from a hearth. */}
      <div className="absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-orange-100/70 via-amber-50/50 to-transparent dark:from-stone-950/85 dark:via-orange-950/40" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-amber-200/50 via-orange-100/30 to-transparent dark:from-orange-900/35 dark:via-red-950/20" />

      {/* Fairy lights. The wire stretches with the screen; the bulbs are
          placed on the same curve so they always hang from it. */}
      <svg
        className="absolute inset-x-0 h-16 w-full"
        style={{ top: WIRE_TOP }}
        viewBox={`0 0 1000 ${WIRE_SAG * 2 + 8}`}
        preserveAspectRatio="none"
      >
        <path
          d={wirePath}
          fill="none"
          className="stroke-stone-500/50 dark:stroke-stone-400/40"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {bulbs.map((x, i) => (
        <span
          key={`bulb-${i}`}
          className="winter-bulb absolute"
          style={
            {
              left: `${x * 100}%`,
              // The viewBox is squashed into 4rem, so scale the drop to match.
              top: `calc(${WIRE_TOP} + ${(wireDrop(x) + 2) / (WIRE_SAG * 2 + 8)} * 4rem)`,
              "--bulb": BULB_COLORS[i % BULB_COLORS.length],
              animationDelay: `${-(i * 0.7) % 3}s`,
            } as Vars
          }
        />
      ))}

      {gusts.map((gust, i) => (
        <svg
          key={`gust-${i}`}
          className="winter-gust absolute left-0 text-amber-700/40 dark:text-amber-100/35"
          width={gust.width}
          height={gust.width * 0.15}
          viewBox="0 0 400 60"
          style={
            {
              top: gust.top,
              "--gust-duration": `${gust.duration}s`,
              "--gust-delay": `${gust.delay}s`,
              "--rest-x": gust.rest,
            } as Vars
          }
        >
          {/* Each gust carries its own fade: a gradient's `currentColor` is
              read where the gradient is defined, so a shared one would take
              the page's text colour instead of this gust's own. */}
          <defs>
            <linearGradient id={`winter-gust-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
              <stop offset="35%" stopColor="currentColor" stopOpacity="0.9" />
              <stop offset="80%" stopColor="currentColor" stopOpacity="0.7" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={gust.curl ? GUST_CURL_PATH : GUST_PATH}
            fill="none"
            stroke={`url(#winter-gust-${i})`}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* A thinner companion streak, so each gust reads as moving air. */}
          <path
            d={GUST_PATH}
            fill="none"
            stroke={`url(#winter-gust-${i})`}
            strokeWidth="1.5"
            strokeLinecap="round"
            transform="translate(40 14) scale(0.8)"
          />
        </svg>
      ))}

      {leaves.map((leaf, i) => (
        <svg
          key={`leaf-${i}`}
          className="winter-leaf absolute left-0"
          width={leaf.size}
          height={leaf.size}
          viewBox="0 0 24 24"
          style={
            {
              top: leaf.top,
              "--leaf-duration": `${leaf.duration}s`,
              "--leaf-delay": `${leaf.delay}s`,
              "--rest-x": leaf.rest,
            } as Vars
          }
        >
          <path d="M3 13 C6 4 16 1 22 3 C20 12 12 20 3 13 Z" fill={leaf.color} />
          <path d="M3 13 C9 11 15 7 20 4" fill="none" stroke="#78350f" strokeWidth="1" />
        </svg>
      ))}

      <FoodLayer extraTreats={winterWear} />

      {/* A mug of cacao in the corner, steam curling off it. Bottom-left: the
          donate button owns the bottom-right. */}
      <svg
        className="winter-mug absolute bottom-4 left-3 w-20 sm:bottom-8 sm:left-8 sm:w-28"
        viewBox="0 -8 100 100"
      >
        {steam.map((wisp, i) => (
          <path
            key={`steam-${i}`}
            className="winter-steam"
            d={wisp.d}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            style={{ animationDelay: `${wisp.delay}s` }}
          />
        ))}
        {/* Handle, then the body over it. */}
        <path
          d="M76 48 C94 48 94 74 74 74"
          fill="none"
          stroke="#991b1b"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d="M22 38 H78 V76 C78 86 70 90 62 90 H38 C30 90 22 86 22 76 Z" fill="#b91c1c" />
        <ellipse cx="50" cy="38" rx="28" ry="6" fill="#7c2d12" />
        <ellipse cx="50" cy="37" rx="22" ry="3.5" fill="#a16207" opacity="0.6" />
        {/* A knitted band around the mug. */}
        <path d="M22 58 H78" stroke="#fef3c7" strokeWidth="5" strokeDasharray="4 4" opacity="0.8" />
        <path
          d="M44 66 C44 62 50 62 50 66 C50 62 56 62 56 66 C56 71 50 74 50 76 C50 74 44 71 44 66 Z"
          fill="#fef3c7"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}
