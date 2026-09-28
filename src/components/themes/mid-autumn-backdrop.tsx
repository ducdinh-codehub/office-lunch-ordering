import type { CSSProperties } from "react";

/*
 * Tết Trung Thu backdrop for the home page: a full moon, lanterns rising past
 * it, đèn ông sao turning, stars and the odd mooncake. Purely decorative —
 * fixed behind the content, no pointer events, hidden from screen readers.
 *
 * Every position and delay is written out rather than randomised so the server
 * and client render the same markup. Delays are negative so the sky is already
 * full on first paint instead of every lantern starting from the floor at once.
 * The animations themselves live in globals.css under `.mooncake-backdrop`.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

const lanterns: {
  left: string;
  size: number;
  duration: number;
  delay: number;
  rest: string;
}[] = [
  { left: "6%", size: 34, duration: 26, delay: -4, rest: "-55vh" },
  { left: "22%", size: 24, duration: 32, delay: -19, rest: "-80vh" },
  { left: "41%", size: 30, duration: 29, delay: -11, rest: "-30vh" },
  { left: "63%", size: 22, duration: 35, delay: -27, rest: "-70vh" },
  { left: "78%", size: 36, duration: 24, delay: -15, rest: "-40vh" },
  { left: "92%", size: 26, duration: 30, delay: -2, rest: "-62vh" },
];

const starLanterns: {
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
}[] = [
  { top: "34%", left: "4%", size: 46, duration: 7, delay: 0 },
  { top: "62%", left: "86%", size: 38, duration: 8.5, delay: -3 },
  { top: "82%", left: "18%", size: 30, duration: 6.5, delay: -5 },
];

const stars: { top: string; left: string; size: number; delay: number }[] = [
  { top: "8%", left: "12%", size: 3, delay: 0 },
  { top: "14%", left: "34%", size: 2, delay: -1.2 },
  { top: "6%", left: "52%", size: 3, delay: -2.4 },
  { top: "22%", left: "58%", size: 2, delay: -0.6 },
  { top: "11%", left: "70%", size: 2, delay: -3.1 },
  { top: "28%", left: "26%", size: 2, delay: -1.8 },
  { top: "40%", left: "48%", size: 3, delay: -2.9 },
  { top: "18%", left: "90%", size: 2, delay: -0.3 },
  { top: "48%", left: "8%", size: 2, delay: -3.6 },
  { top: "54%", left: "72%", size: 3, delay: -1.5 },
];

const mooncakes: { top: string; left: string; size: string; drift: string }[] = [
  { top: "70%", left: "58%", size: "2.25rem", drift: "animate-drift-a" },
  { top: "44%", left: "30%", size: "1.75rem", drift: "animate-drift-b" },
  { top: "88%", left: "80%", size: "2rem", drift: "animate-drift-c" },
];

export function MidAutumnBackdrop() {
  return (
    <div
      aria-hidden
      className="mooncake-backdrop pointer-events-none fixed inset-0 m-0 -z-10 overflow-hidden"
    >
      {/* Shared gradients for every lantern below. */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <radialGradient id="mc-lantern-body" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffd36b" />
            <stop offset="45%" stopColor="#f25c2a" />
            <stop offset="100%" stopColor="#a3120f" />
          </radialGradient>
          <linearGradient id="mc-star-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe08a" />
            <stop offset="55%" stopColor="#f7a520" />
            <stop offset="100%" stopColor="#d6361f" />
          </linearGradient>
        </defs>
      </svg>

      {/* A warm wash from the top, stronger at night. */}
      <div className="absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-amber-100/60 via-orange-50/30 to-transparent dark:from-indigo-950/70 dark:via-indigo-950/30" />

      {/* The moon, its halo and the clouds passing over it. */}
      <div className="mooncake-moon absolute -top-10 -right-12 size-56 rounded-full sm:top-6 sm:right-10 sm:size-64">
        <span className="absolute top-[30%] left-[24%] size-8 rounded-full bg-amber-300/40" />
        <span className="absolute top-[56%] left-[52%] size-12 rounded-full bg-amber-300/30" />
        <span className="absolute top-[22%] left-[62%] size-5 rounded-full bg-amber-300/35" />
      </div>
      <div
        className="mooncake-cloud absolute top-28 right-0 h-8 w-44 sm:top-44"
        style={{ "--cloud-duration": "38s", "--cloud-delay": "-6s" } as Vars}
      />
      <div
        className="mooncake-cloud absolute top-16 right-0 h-6 w-32 sm:top-24"
        style={{ "--cloud-duration": "52s", "--cloud-delay": "-30s" } as Vars}
      />

      {stars.map((star, i) => (
        <span
          key={`star-${i}`}
          className="mooncake-star absolute rounded-full bg-amber-400 dark:bg-amber-100"
          style={{
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {lanterns.map((lantern, i) => (
        <div
          key={`lantern-${i}`}
          className="mooncake-rise absolute -bottom-24"
          style={
            {
              left: lantern.left,
              "--rise-duration": `${lantern.duration}s`,
              "--rise-delay": `${lantern.delay}s`,
              "--rest-y": lantern.rest,
            } as Vars
          }
        >
          <svg
            className="mooncake-sway"
            width={lantern.size}
            height={lantern.size * 1.8}
            viewBox="0 0 40 72"
            style={{ animationDelay: `${lantern.delay / 3}s` }}
          >
            <line x1="20" y1="0" x2="20" y2="10" stroke="#b7791f" strokeWidth="1.2" />
            <rect x="12" y="9" width="16" height="4" rx="1.5" fill="#e0a526" />
            <ellipse cx="20" cy="31" rx="16" ry="18" fill="url(#mc-lantern-body)" />
            <ellipse
              cx="20"
              cy="31"
              rx="8"
              ry="18"
              fill="none"
              stroke="#ffcf5a"
              strokeOpacity="0.55"
              strokeWidth="1"
            />
            <line
              x1="20"
              y1="13"
              x2="20"
              y2="49"
              stroke="#ffcf5a"
              strokeOpacity="0.45"
              strokeWidth="1"
            />
            <rect x="12" y="48" width="16" height="4" rx="1.5" fill="#e0a526" />
            <line x1="20" y1="52" x2="20" y2="66" stroke="#e0a526" strokeWidth="1.5" />
            <path d="M16 62 L20 72 L24 62 Z" fill="#d6361f" />
          </svg>
        </div>
      ))}

      {starLanterns.map((star, i) => (
        <svg
          key={`ong-sao-${i}`}
          className="mooncake-ong-sao absolute"
          width={star.size}
          height={star.size}
          viewBox="0 0 100 100"
          style={{
            top: star.top,
            left: star.left,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        >
          <polygon
            points="50,4 61,38 97,38 68,59 79,94 50,73 21,94 32,59 3,38 39,38"
            fill="url(#mc-star-body)"
            stroke="#fff3c4"
            strokeOpacity="0.7"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <polygon
            points="50,30 56,46 72,46 59,56 64,72 50,62 36,72 41,56 28,46 44,46"
            fill="#fff3c4"
            fillOpacity="0.45"
          />
        </svg>
      ))}

      {mooncakes.map((cake, i) => (
        <span
          key={`cake-${i}`}
          className={`absolute opacity-25 dark:opacity-35 ${cake.drift}`}
          style={{ top: cake.top, left: cake.left, fontSize: cake.size }}
        >
          🥮
        </span>
      ))}
    </div>
  );
}
