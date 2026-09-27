import type { CSSProperties } from "react";

import { BoiledChicken, PhoBowl, SpringRolls } from "./dishes";

/*
 * Tết Nguyên Đán backdrop: red lanterns swaying from just under the header, a
 * branch of hoa mai in the corner, mai and đào petals falling, fireworks
 * blooming now and then, lì xì envelopes rising, and the Tết table floating
 * faintly — bánh chưng, gà luộc, phở, chả giò and the fruit of the mâm ngũ quả. Purely decorative: fixed behind the
 * content, no pointer events, hidden from screen readers.
 *
 * Every position and delay is written out rather than randomised so the server
 * and client render the same markup. Delays are negative so the sky is already
 * full on first paint. The animations live in globals.css under `.tet-backdrop`.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

/** Just under the app shell's frosted `h-14` header, which blurs what is behind. */
const HEADER = "3.5rem";

/** Hanging lanterns: how far along the top, how long the string, how big. */
const lanterns: { left: string; string: number; size: number; delay: number }[] = [
  { left: "4%", string: 28, size: 42, delay: 0 },
  { left: "16%", string: 64, size: 30, delay: -1.4 },
  { left: "78%", string: 44, size: 36, delay: -2.2 },
  { left: "91%", string: 16, size: 46, delay: -0.7 },
];

const petals: {
  left: string;
  size: number;
  duration: number;
  delay: number;
  rest: string;
  /** Hoa mai (yellow, the South's) or hoa đào (pink, the North's). */
  kind: "mai" | "dao";
}[] = [
  { left: "5%", size: 14, duration: 17, delay: -4, rest: "30vh", kind: "mai" },
  { left: "13%", size: 11, duration: 21, delay: -13, rest: "62vh", kind: "dao" },
  { left: "22%", size: 15, duration: 19, delay: -8, rest: "44vh", kind: "mai" },
  { left: "31%", size: 10, duration: 23, delay: -17, rest: "80vh", kind: "dao" },
  { left: "40%", size: 13, duration: 18, delay: -1, rest: "18vh", kind: "mai" },
  { left: "49%", size: 12, duration: 22, delay: -11, rest: "56vh", kind: "dao" },
  { left: "58%", size: 14, duration: 20, delay: -15, rest: "70vh", kind: "mai" },
  { left: "66%", size: 10, duration: 24, delay: -6, rest: "36vh", kind: "dao" },
  { left: "74%", size: 15, duration: 18, delay: -19, rest: "88vh", kind: "mai" },
  { left: "83%", size: 11, duration: 21, delay: -3, rest: "24vh", kind: "dao" },
  { left: "90%", size: 13, duration: 19, delay: -10, rest: "50vh", kind: "mai" },
  { left: "97%", size: 11, duration: 25, delay: -21, rest: "74vh", kind: "dao" },
];

/** Where fireworks bloom, and on what beat. */
const fireworks: { top: string; left: string; size: number; color: string; delay: number }[] = [
  { top: "18%", left: "28%", size: 120, color: "#fbbf24", delay: 0 },
  { top: "12%", left: "62%", size: 90, color: "#f87171", delay: -2.3 },
  { top: "34%", left: "86%", size: 100, color: "#fde68a", delay: -4.1 },
  { top: "40%", left: "8%", size: 80, color: "#fb7185", delay: -1.2 },
];

const envelopes: { left: string; size: string; duration: number; delay: number; rest: string }[] = [
  { left: "10%", size: "1.75rem", duration: 32, delay: -5, rest: "-40vh" },
  { left: "35%", size: "1.5rem", duration: 38, delay: -21, rest: "-70vh" },
  { left: "54%", size: "2rem", duration: 35, delay: -12, rest: "-55vh" },
  { left: "71%", size: "1.5rem", duration: 41, delay: -30, rest: "-25vh" },
  { left: "88%", size: "1.75rem", duration: 34, delay: -2, rest: "-62vh" },
];

/**
 * `phone` keeps an item on narrow screens; the rest appear from Tailwind's `sm`
 * breakpoint up. A phone's column is all cards, so the full spread is clutter.
 */
const PHONE_HIDDEN = "hidden sm:block";

const offerings: {
  top: string;
  left: string;
  size: string;
  emoji: string;
  drift: string;
  phone?: true;
}[] = [
  { top: "52%", left: "84%", size: "1.75rem", emoji: "🍊", drift: "animate-drift-b", phone: true },
  { top: "68%", left: "30%", size: "1.75rem", emoji: "🍉", drift: "animate-drift-c" },
  { top: "28%", left: "48%", size: "1.5rem", emoji: "🌸", drift: "animate-drift-a" },
  { top: "84%", left: "62%", size: "1.5rem", emoji: "🪙", drift: "animate-drift-b" },
  { top: "44%", left: "22%", size: "1.5rem", emoji: "🍬", drift: "animate-drift-a" },
];

const banhChung: { top: string; left: string; width: string; drift: string; phone?: true }[] = [
  { top: "60%", left: "3%", width: "4rem", drift: "animate-drift-c", phone: true },
  { top: "22%", left: "70%", width: "3rem", drift: "animate-drift-a" },
];

/**
 * The drawn dishes of the Tết table: gà luộc from the altar tray, and the phở
 * and chả giò the family eats together. The chicken is the one kept on phones —
 * it is the most Tết of the three.
 */
const DISHES = { "ga-luoc": BoiledChicken, pho: PhoBowl, "cha-gio": SpringRolls } as const;

const dishes: {
  top: string;
  left: string;
  width: string;
  dish: keyof typeof DISHES;
  drift: string;
  phone?: true;
}[] = [
  {
    top: "42%",
    left: "80%",
    width: "6.5rem",
    dish: "ga-luoc",
    drift: "animate-drift-b",
    phone: true,
  },
  { top: "76%", left: "36%", width: "5rem", dish: "pho", drift: "animate-drift-a" },
  { top: "30%", left: "8%", width: "5.5rem", dish: "cha-gio", drift: "animate-drift-c" },
];

/** Mai blossoms on the corner branch: where they sit and how open they are. */
const branchBlossoms: { x: number; y: number; r: number }[] = [
  { x: 40, y: 150, r: 9 },
  { x: 66, y: 118, r: 11 },
  { x: 92, y: 96, r: 8 },
  { x: 120, y: 70, r: 12 },
  { x: 148, y: 52, r: 9 },
  { x: 60, y: 84, r: 8 },
  { x: 104, y: 128, r: 9 },
  { x: 170, y: 30, r: 10 },
];

function Blossom({ r, color, center }: { r: number; color: string; center: string }) {
  return (
    <>
      {[0, 72, 144, 216, 288].map((angle) => (
        <ellipse
          key={angle}
          cx="0"
          cy={-r * 0.55}
          rx={r * 0.42}
          ry={r * 0.6}
          fill={color}
          transform={`rotate(${angle})`}
        />
      ))}
      <circle r={r * 0.28} fill={center} />
    </>
  );
}

function Lantern({ size }: { size: number }) {
  return (
    <svg width={size} height={size * 1.6} viewBox="0 0 50 80">
      <rect x="15" y="0" width="20" height="6" rx="2" fill="#ca8a04" />
      <ellipse cx="25" cy="30" rx="22" ry="24" fill="#dc2626" />
      <ellipse cx="25" cy="30" rx="12" ry="24" fill="none" stroke="#fbbf24" strokeOpacity="0.6" />
      <ellipse cx="25" cy="30" rx="3" ry="24" fill="none" stroke="#fbbf24" strokeOpacity="0.5" />
      <rect x="15" y="52" width="20" height="6" rx="2" fill="#ca8a04" />
      {[19, 22, 25, 28, 31].map((x) => (
        <line key={x} x1={x} y1="58" x2={x} y2="78" stroke="#dc2626" strokeWidth="1.4" />
      ))}
    </svg>
  );
}

function BanhChung({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 80">
      <rect x="6" y="6" width="68" height="68" rx="6" fill="#166534" />
      <rect x="12" y="12" width="56" height="56" rx="4" fill="#15803d" />
      <path d="M12 26 H68 M12 54 H68" stroke="#14532d" strokeOpacity="0.5" strokeWidth="1" />
      {/* Lạt tre: the bamboo ties, two each way. */}
      <g stroke="#e7d3a1" strokeWidth="3">
        <line x1="30" y1="6" x2="30" y2="74" />
        <line x1="50" y1="6" x2="50" y2="74" />
        <line x1="6" y1="30" x2="74" y2="30" />
        <line x1="6" y1="50" x2="74" y2="50" />
      </g>
    </svg>
  );
}

export function LunarNewYearBackdrop() {
  return (
    <div
      aria-hidden
      className="tet-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {/* Red and gold by day; a deep red night by night. */}
      <div className="absolute inset-x-0 top-0 h-[60vh] bg-gradient-to-b from-red-100/70 via-amber-50/40 to-transparent dark:from-red-950/80 dark:via-amber-950/30" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-amber-100/60 to-transparent dark:from-red-950/40" />

      {fireworks.map((burst, i) => (
        <svg
          key={`burst-${i}`}
          className="tet-burst absolute"
          width={burst.size}
          height={burst.size}
          viewBox="-50 -50 100 100"
          style={{
            top: burst.top,
            left: burst.left,
            color: burst.color,
            animationDelay: `${burst.delay}s`,
          }}
        >
          {Array.from({ length: 12 }, (_, spoke) => (
            <g key={spoke} transform={`rotate(${spoke * 30})`}>
              <line
                x1="0"
                y1="-14"
                x2="0"
                y2="-40"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cy="-46" r="2.5" fill="currentColor" />
            </g>
          ))}
        </svg>
      ))}

      {lanterns.map((lantern, i) => (
        <div
          key={`lantern-${i}`}
          className="tet-swing absolute flex flex-col items-center"
          style={{
            top: HEADER,
            left: lantern.left,
            animationDelay: `${lantern.delay}s`,
          }}
        >
          <span className="w-px bg-amber-700/60" style={{ height: lantern.string }} />
          <Lantern size={lantern.size} />
        </div>
      ))}

      {petals.map((petal, i) => (
        <div
          key={`petal-${i}`}
          className="tet-fall absolute -top-8"
          style={
            {
              left: petal.left,
              "--fall-duration": `${petal.duration}s`,
              "--fall-delay": `${petal.delay}s`,
              "--rest-y": petal.rest,
            } as Vars
          }
        >
          <svg
            className="tet-spin"
            width={petal.size}
            height={petal.size}
            viewBox="-12 -12 24 24"
            style={{ animationDelay: `${petal.delay / 2}s` }}
          >
            {petal.kind === "mai" ? (
              <Blossom r={11} color="#facc15" center="#ea580c" />
            ) : (
              <Blossom r={11} color="#f9a8d4" center="#db2777" />
            )}
          </svg>
        </div>
      ))}

      {offerings.map((item, i) => (
        <span
          key={`offering-${i}`}
          className={`absolute opacity-25 dark:opacity-35 ${item.drift} ${item.phone ? "" : PHONE_HIDDEN}`}
          style={{ top: item.top, left: item.left, fontSize: item.size }}
        >
          {item.emoji}
        </span>
      ))}

      {banhChung.map((cake, i) => (
        <div
          key={`banh-chung-${i}`}
          className={`absolute opacity-35 dark:opacity-45 ${cake.drift} ${cake.phone ? "" : PHONE_HIDDEN}`}
          style={{ top: cake.top, left: cake.left, width: cake.width }}
        >
          <BanhChung className="block w-full" />
        </div>
      ))}

      {dishes.map((entry, i) => {
        const Dish = DISHES[entry.dish];
        return (
          <div
            key={`dish-${i}`}
            className={`food-dish absolute ${entry.drift} ${entry.phone ? "" : PHONE_HIDDEN}`}
            style={{ top: entry.top, left: entry.left, width: entry.width }}
          >
            <Dish className="block w-full" />
          </div>
        );
      })}

      {envelopes.map((envelope, i) => (
        <div
          key={`li-xi-${i}`}
          className="tet-rise absolute -bottom-12"
          style={
            {
              left: envelope.left,
              fontSize: envelope.size,
              "--rise-duration": `${envelope.duration}s`,
              "--rise-delay": `${envelope.delay}s`,
              "--rest-y": envelope.rest,
            } as Vars
          }
        >
          <span className="tet-sway block opacity-40 dark:opacity-50">🧧</span>
        </div>
      ))}

      {/* A branch of hoa mai reaching in from the bottom-left corner. */}
      <svg className="tet-branch absolute bottom-0 left-0 w-52 sm:w-72" viewBox="0 0 200 200">
        <path
          d="M0 200 C20 170 34 160 46 146 C60 128 70 116 94 94 C112 78 130 64 176 26"
          fill="none"
          stroke="#78350f"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M58 132 C56 110 58 96 60 84 M100 90 C104 104 104 116 104 128"
          fill="none"
          stroke="#78350f"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {branchBlossoms.map((blossom, i) => (
          <g key={i} transform={`translate(${blossom.x} ${blossom.y})`}>
            <Blossom r={blossom.r} color="#facc15" center="#ea580c" />
          </g>
        ))}
      </svg>
    </div>
  );
}
