import type { CSSProperties } from "react";

import { Figure, HAIR, PANTS, SHIRTS, SKINS, type Look, type Pose } from "./alegria";
import { Bird, Cloud, driftStyle } from "./sky";

/*
 * Travel backdrop (welcome screen), drawn like a travel poster: a soft
 * golden-hour sky with the sun low over layered mountain ranges, thin clouds
 * and a few gulls drifting, a plane with its contrail, two hot-air balloons far
 * off; below, Hạ Long-style limestone islands in a calm bay a sailboat
 * crosses, and a strip of beach with palm silhouettes where travellers in the
 * flat "Alegria" style (`./alegria.tsx`) walk with a suitcase, read a map,
 * take a photo and point out the view.
 *
 * Kept grown-up on purpose: one muted palette, silhouettes rather than
 * cartoons, no emoji, and everything slow. Purely decorative: fixed behind the
 * content, no pointer events, hidden from screen readers.
 *
 * Every position and delay is written out rather than randomised so the server
 * and client render the same markup. Delays are negative so the scene is
 * already moving on first paint. The animations live in globals.css under
 * `.travel-backdrop`.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

const clouds: { top: string; width: number; duration: number; delay: number; opacity: number }[] = [
  { top: "10%", width: 280, duration: 140, delay: -20, opacity: 0.7 },
  { top: "20%", width: 200, duration: 170, delay: -90, opacity: 0.55 },
  { top: "32%", width: 240, duration: 155, delay: -55, opacity: 0.45 },
  { top: "15%", width: 160, duration: 190, delay: -140, opacity: 0.5 },
];

const gulls: { top: string; size: number; duration: number; delay: number }[] = [
  { top: "30%", size: 22, duration: 70, delay: -18 },
  { top: "33%", size: 16, duration: 70, delay: -21 },
  { top: "46%", size: 18, duration: 85, delay: -50 },
];

const balloons: { left: string; width: number; color: string; duration: number; delay: number }[] = [
  { left: "12%", width: 30, color: "#c8775a", duration: 120, delay: -40 },
  { left: "74%", width: 22, color: "#8fa98f", duration: 140, delay: -95 },
];

/** Shimmer on the bay: short strokes of light that fade in and out. */
const glints: { left: string; bottom: string; width: string; delay: number }[] = [
  { left: "18%", bottom: "4.25rem", width: "3rem", delay: 0 },
  { left: "34%", bottom: "3.5rem", width: "2rem", delay: -1.6 },
  { left: "52%", bottom: "4.5rem", width: "2.5rem", delay: -3.1 },
  { left: "68%", bottom: "3.75rem", width: "3.5rem", delay: -0.8 },
  { left: "84%", bottom: "4.25rem", width: "2rem", delay: -2.4 },
];

const look = (
  i: number,
  hairStyle: Look["hairStyle"],
  sleeves: Look["sleeves"] = "short",
): Look => ({
  skin: SKINS[i % SKINS.length],
  shirt: SHIRTS[i % SHIRTS.length],
  pants: PANTS[i % PANTS.length],
  hair: HAIR[i % HAIR.length],
  hairStyle,
  sleeves,
});

/** Striding right, the suitcase in the right hand. */
const WALK: Pose = {
  hip: [0, -78],
  neck: [5, -134],
  armL: [[-18, -106], [-28, -81]],
  armR: [[24, -104], [30, -77]],
  legL: [[-10, -42], [-24, -4]],
  legR: [[14, -41], [22, -4]],
};

/** Both hands up, a camera held to the face. */
const PHOTO: Pose = {
  hip: [0, -78],
  neck: [0, -134],
  armL: [[-30, -116], [-14, -149]],
  armR: [[30, -116], [14, -149]],
  legL: [[-10, -40], [-14, -4]],
  legR: [[10, -40], [14, -4]],
};

/** A map held open at chest height. */
const MAP: Pose = {
  hip: [0, -78],
  neck: [0, -134],
  armL: [[-28, -108], [-17, -110]],
  armR: [[28, -108], [17, -110]],
  legL: [[-8, -40], [-9, -4]],
  legR: [[9, -40], [12, -4]],
};

/** Pointing out to the right, the other hand on the hip. */
const POINT: Pose = {
  hip: [0, -78],
  neck: [2, -134],
  armL: [[-28, -108], [-14, -88]],
  armR: [[40, -138], [66, -145]],
  legL: [[-8, -40], [-9, -4]],
  legR: [[9, -40], [12, -4]],
};

/** One standing figure in its own box, feet on the bottom edge. */
const FIGURE_BOX = "-60 -182 140 188";

function Plane() {
  return (
    <svg width="54" height="22" viewBox="0 0 120 50" overflow="visible">
      <defs>
        <linearGradient id="travel-contrail" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0.9" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* The contrail, fading out behind the plane. */}
      <path
        d="M-340 28 L22 26"
        stroke="url(#travel-contrail)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g fill="currentColor">
        <path d="M20 26 L98 22 C112 22 116 26 106 30 L24 31 Z" />
        <path d="M56 24 L42 4 L50 4 L72 24 Z" />
        <path d="M58 30 L46 46 L54 46 L74 30 Z" />
        <path d="M24 27 L16 12 L22 12 L34 27 Z" />
      </g>
    </svg>
  );
}

function Balloon({ width, color }: { width: number; color: string }) {
  return (
    <svg width={width} height={width * 1.5} viewBox="0 0 60 90">
      <path
        d="M30 2 C8 2 2 22 6 36 C10 48 22 56 24 62 L36 62 C38 56 50 48 54 36 C58 22 52 2 30 2 Z"
        fill={color}
      />
      <path
        d="M30 2 C24 2 20 22 21 36 C22 48 26 56 27 62 L33 62 C34 56 38 48 39 36 C40 22 36 2 30 2 Z"
        fill="white"
        opacity="0.25"
      />
      <path d="M25 62 L27 74 M35 62 L33 74" stroke="#6b5b4f" strokeWidth="1" />
      <rect x="25" y="74" width="10" height="8" rx="1.5" fill="#6b5b4f" />
    </svg>
  );
}

function Sailboat() {
  return (
    <svg width="44" height="48" viewBox="0 0 64 70">
      <path d="M31 4 L31 48 L10 48 Z" className="fill-white dark:fill-slate-300" />
      <path d="M34 12 L34 48 L52 48 Z" className="fill-[#e9e1d4] dark:fill-slate-400" />
      <path d="M30 2 L30 50" stroke="#475569" strokeWidth="1.5" />
      <path d="M6 50 L58 50 L50 60 L14 60 Z" fill="#475569" />
    </svg>
  );
}

function Palm({ className, flip }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 180"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g className="fill-[#3f5a52] dark:fill-[#1f2f2b]">
        <path d="M54 178 C58 140 66 100 61 62 L67 62 C72 100 66 140 62 178 Z" />
        {/* The fronds sway together from the top of the trunk. */}
        <g className="travel-frond">
          <path d="M64 60 C44 42 18 44 2 60 C24 52 44 56 64 64 Z" />
          <path d="M64 60 C84 40 110 44 118 60 C100 52 82 56 64 64 Z" />
          <path d="M64 60 C52 36 34 24 16 26 C36 34 52 48 62 64 Z" />
          <path d="M64 60 C78 34 96 24 112 28 C92 34 78 48 66 64 Z" />
          <path d="M64 60 C62 38 66 22 76 12 C72 30 70 46 66 62 Z" />
        </g>
      </g>
    </svg>
  );
}

export function TravelBackdrop() {
  return (
    <div
      aria-hidden
      className="travel-backdrop pointer-events-none fixed inset-0 m-0 -z-10 overflow-hidden select-none"
    >
      {/* Golden hour: cool blue above, warming towards the horizon. Night is a deep navy. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#d6e4ec] via-[#eef0ec] to-[#f6e4cf] dark:from-[#0f172a] dark:via-[#1e2235] dark:to-[#2b2632]" />

      {/* The sun, low and soft, setting behind the far range. */}
      <div className="travel-sun absolute right-[16%] bottom-[29%] size-28 rounded-full sm:size-40" />

      {clouds.map((cloud, i) => (
        <div
          key={`cloud-${i}`}
          className="sky-drift absolute left-0"
          style={{ ...driftStyle(cloud.top, cloud.duration, cloud.delay), opacity: cloud.opacity }}
        >
          <Cloud width={cloud.width} />
        </div>
      ))}

      {gulls.map((gull, i) => (
        <div
          key={`gull-${i}`}
          className="sky-drift absolute left-0 text-slate-600/60 dark:text-slate-300/50"
          style={driftStyle(gull.top, gull.duration, gull.delay)}
        >
          <Bird size={gull.size} />
        </div>
      ))}

      <div className="travel-plane absolute top-[16%] left-0 text-slate-500 dark:text-slate-300">
        <Plane />
      </div>

      {balloons.map((balloon, i) => (
        <div
          key={`balloon-${i}`}
          className="travel-balloon absolute -bottom-32"
          style={
            {
              left: balloon.left,
              "--balloon-duration": `${balloon.duration}s`,
              "--balloon-delay": `${balloon.delay}s`,
            } as Vars
          }
        >
          <div className="travel-sway" style={{ animationDelay: `${balloon.delay / 4}s` }}>
            <Balloon width={balloon.width} color={balloon.color} />
          </div>
        </div>
      ))}

      {/* Three ranges, paler with distance, then the islands and the bay. */}
      <svg
        className="absolute inset-x-0 bottom-6 h-[38vh] w-full sm:bottom-8"
        viewBox="0 0 1200 300"
        preserveAspectRatio="none"
      >
        <path
          d="M0 170 C80 150 140 110 220 118 C300 126 340 80 430 84 C520 88 560 130 660 120 C760 110 820 64 920 70 C1020 76 1100 120 1200 108 L1200 300 L0 300 Z"
          className="fill-[#c9d5d9] dark:fill-[#2a3245]"
        />
        <path
          d="M0 200 C100 186 160 150 260 160 C360 170 420 132 520 140 C620 148 700 186 800 172 C900 158 980 128 1080 140 C1140 148 1170 160 1200 158 L1200 300 L0 300 Z"
          className="fill-[#a9bfb8] dark:fill-[#243a3a]"
        />
        <path
          d="M0 248 C120 236 240 252 360 244 C480 236 600 254 720 246 C840 238 960 254 1080 246 C1140 242 1180 246 1200 246 L1200 300 L0 300 Z"
          className="fill-[#9dbccb] dark:fill-[#1c3344]"
        />
        <g className="fill-[#6f8f86] dark:fill-[#1f3532]">
          <path d="M590 250 C586 196 600 170 616 168 C634 166 640 206 636 250 Z" />
          <path d="M640 250 C640 220 648 206 660 206 C672 208 676 230 674 250 Z" />
          <path d="M760 252 C752 186 770 150 790 148 C812 148 820 196 812 252 Z" />
          <path d="M818 252 C818 226 826 212 836 212 C846 214 848 234 846 252 Z" />
          <path d="M230 248 C226 212 238 194 250 194 C264 196 266 222 262 248 Z" />
        </g>
      </svg>

      {glints.map((glint, i) => (
        <span
          key={`glint-${i}`}
          className="travel-glint absolute h-px bg-white/80 dark:bg-slate-300/40"
          style={{
            left: glint.left,
            bottom: glint.bottom,
            width: glint.width,
            animationDelay: `${glint.delay}s`,
          }}
        />
      ))}

      {/* The sailboat crosses the bay, rocking gently. */}
      <div className="travel-sail absolute bottom-9 left-0 sm:bottom-11">
        <div className="travel-bob">
          <Sailboat />
        </div>
      </div>

      {/* The beach in front of it all. */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-[#e8dcc4] sm:h-12 dark:bg-[#3a3328]" />

      {/* The travellers, on the sand — two of them, smaller, on a phone. */}
      <svg
        className="alegria-stroll absolute bottom-1 left-[22%] h-28 sm:h-[min(10rem,20vh)] lg:h-[min(12rem,21vh)]"
        viewBox={FIGURE_BOX}
      >
        <Figure
          pose={WALK}
          look={look(0, "short")}
          behind={
            <g>
              <path
                d="M24 -66 L24 -78 L38 -78 L38 -66"
                fill="none"
                stroke="#3b3a40"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <rect x="16" y="-66" width="32" height="50" rx="6" fill="#c4654a" />
              <path d="M24 -56 L24 -26 M40 -56 L40 -26" stroke="#a5523a" strokeWidth="3" />
              <circle cx="22" cy="-13" r="3.5" fill="#3b3a40" />
              <circle cx="42" cy="-13" r="3.5" fill="#3b3a40" />
            </g>
          }
        />
      </svg>

      <svg
        className="absolute bottom-1 left-[38%] hidden h-[min(10rem,20vh)] md:block lg:h-[min(12rem,21vh)]"
        viewBox={FIGURE_BOX}
      >
        <Figure
          pose={MAP}
          look={look(1, "bun", "long")}
          behind={<rect x="-32" y="-134" width="20" height="44" rx="8" fill="#5b4636" />}
          front={
            <g>
              <path
                d="M-15 -121 L-5 -117 L5 -121 L15 -117 L15 -97 L5 -101 L-5 -97 L-15 -101 Z"
                fill="#efe6d4"
              />
              <path d="M-5 -117 L-5 -97 M5 -121 L5 -101" stroke="#c9bba2" strokeWidth="1.5" />
              <path d="M-11 -110 Q0 -114 11 -106" fill="none" stroke="#c4654a" strokeWidth="1.5" />
            </g>
          }
        />
      </svg>

      <svg
        className="absolute right-[22%] bottom-1 h-28 sm:right-[4%] sm:h-[min(10rem,20vh)] md:right-auto md:left-[58%] lg:h-[min(12rem,21vh)]"
        viewBox={FIGURE_BOX}
      >
        <Figure
          pose={PHOTO}
          look={look(2, "long")}
          front={
            <g>
              <rect x="-16" y="-160" width="32" height="19" rx="4" fill="#2b2f3a" />
              <rect x="-10" y="-164" width="8" height="5" rx="1.5" fill="#2b2f3a" />
              <circle cx="0" cy="-150.5" r="6" fill="#6f8f9c" />
              <circle cx="0" cy="-150.5" r="2.5" fill="#2b2f3a" />
            </g>
          }
        />
      </svg>

      {/* Mirrored, so the pointing hand reaches back towards the bay. */}
      <svg
        className="absolute right-[20%] bottom-1 hidden h-[min(12rem,21vh)] -scale-x-100 lg:block"
        viewBox={FIGURE_BOX}
      >
        <Figure pose={POINT} look={look(5, "curly")} />
      </svg>

      <Palm className="absolute bottom-3 -left-4 w-28 sm:left-2 sm:w-36" />
      <Palm className="absolute bottom-3 left-32 hidden w-20 sm:block" flip />
      <Palm className="absolute -right-6 bottom-3 w-24 sm:right-4 sm:w-32" flip />
    </div>
  );
}
