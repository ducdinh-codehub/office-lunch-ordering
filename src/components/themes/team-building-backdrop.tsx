import type { CSSProperties } from "react";

import {
  Blob,
  Figure,
  HAIR,
  LeafPlant,
  PANTS,
  SHIRTS,
  SKINS,
  type Look,
  type Pose,
} from "./alegria";
import { Bird, Cloud, driftStyle } from "./sky";

/*
 * Team building backdrop (welcome screen), an offsite at golden hour drawn in
 * the flat "Alegria" style (`./alegria.tsx`): clouds and birds crossing the
 * sky, soft blobs and a setting sun behind layered hills, big-leaf plants at the edges, and on the grass the
 * team — one cheering, two high-fiving, one waving the team flag, one resting
 * by the campfire beside the tents, and a tug-of-war. Fireflies blink over
 * the field.
 *
 * Kept grown-up on purpose: the style's long limbs and faceless heads, but in
 * one muted palette, with no emoji or confetti, and everything slow. Purely
 * decorative: fixed behind the content, no pointer events, hidden from screen
 * readers.
 *
 * Every position and delay is written out rather than randomised so the server
 * and client render the same markup. The animations live in globals.css under
 * `.team-backdrop` and `.alegria-*`.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

/** Thin clouds and a few birds crossing the sky — above the card, even on a phone. */
const clouds: { top: string; width: number; duration: number; delay: number; opacity: number }[] = [
  { top: "5%", width: 220, duration: 120, delay: -30, opacity: 0.8 },
  { top: "11%", width: 150, duration: 150, delay: -95, opacity: 0.65 },
  { top: "17%", width: 260, duration: 170, delay: -60, opacity: 0.5 },
];

const birds: { top: string; size: number; duration: number; delay: number }[] = [
  { top: "8%", size: 18, duration: 55, delay: -10 },
  { top: "10%", size: 13, duration: 55, delay: -12 },
  { top: "14%", size: 15, duration: 70, delay: -38 },
];

const embers: { left: string; duration: number; delay: number; drift: string }[] = [
  { left: "46%", duration: 5, delay: 0, drift: "-10px" },
  { left: "52%", duration: 6, delay: -1.5, drift: "12px" },
  { left: "49%", duration: 4.5, delay: -3, drift: "-6px" },
  { left: "55%", duration: 5.5, delay: -2.2, drift: "8px" },
  { left: "43%", duration: 6.5, delay: -4.1, drift: "-14px" },
];

const fireflies: { left: string; bottom: string; delay: number }[] = [
  { left: "8%", bottom: "30%", delay: 0 },
  { left: "22%", bottom: "24%", delay: -1.4 },
  { left: "35%", bottom: "33%", delay: -2.8 },
  { left: "63%", bottom: "28%", delay: -0.7 },
  { left: "77%", bottom: "35%", delay: -2.1 },
  { left: "90%", bottom: "26%", delay: -3.5 },
  { left: "15%", bottom: "40%", delay: -4.2 },
  { left: "84%", bottom: "42%", delay: -1.9 },
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

/** Both arms up. */
const CHEER: Pose = {
  hip: [0, -78],
  neck: [0, -134],
  armL: [[-30, -156], [-38, -183]],
  armR: [[30, -156], [38, -183]],
  legL: [[-10, -40], [-14, -4]],
  legR: [[12, -41], [17, -5]],
};

/** Facing right, the right hand up for the high five. */
const HIGH_FIVE: Pose = {
  hip: [0, -78],
  neck: [3, -134],
  armL: [[-16, -104], [-17, -77]],
  armR: [[32, -155], [44, -180]],
  legL: [[-9, -40], [-12, -4]],
  legR: [[9, -40], [13, -4]],
};

/** The flag pole in the right hand, the left hand waving. */
const FLAG_BEARER: Pose = {
  hip: [0, -78],
  neck: [0, -134],
  armL: [[-30, -155], [-36, -182]],
  armR: [[30, -108], [34, -134]],
  legL: [[-8, -40], [-9, -4]],
  legR: [[9, -40], [12, -4]],
};

/** Leaning back to the left, both hands on a rope to the right. */
const PULL: Pose = {
  hip: [0, -74],
  neck: [-20, -128],
  armL: [[-12, -104], [14, -97]],
  armR: [[12, -112], [30, -98]],
  legL: [[-8, -38], [-8, -4]],
  legR: [[16, -40], [30, -4]],
};

/** On a log, facing right towards the fire, hands on knees. */
const SIT: Pose = {
  hip: [0, -34],
  neck: [-3, -90],
  armL: [[-6, -64], [18, -46]],
  armR: [[18, -66], [30, -46]],
  legL: [[22, -36], [22, -4]],
  legR: [[28, -38], [30, -4]],
};

function Tent({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90">
      <path d="M60 4 L114 88 L6 88 Z" fill={color} />
      <path d="M60 4 L88 88 L32 88 Z" fill="black" opacity="0.1" />
      <path d="M60 34 L74 88 L46 88 Z" fill="#3b2f2a" opacity="0.7" />
      <path d="M60 4 L60 0" stroke="#5b4a3f" strokeWidth="3" />
    </svg>
  );
}

function Campfire({ className }: { className?: string }) {
  return (
    <div className={className}>
      {/* The glow on the grass around it. */}
      <div className="team-glow absolute -inset-10 rounded-full" />
      {embers.map((ember, i) => (
        <span
          key={i}
          className="team-ember absolute bottom-10 block size-1 rounded-full bg-[#f2b25c]"
          style={
            {
              left: ember.left,
              "--ember-duration": `${ember.duration}s`,
              "--ember-delay": `${ember.delay}s`,
              "--ember-drift": ember.drift,
            } as Vars
          }
        />
      ))}
      <svg className="relative w-full" viewBox="0 0 80 80">
        <g className="team-flame">
          <path
            d="M40 10 C54 28 58 42 52 58 C48 68 32 68 28 58 C22 42 30 28 40 10 Z"
            fill="#d9773f"
          />
          <path
            d="M40 28 C48 40 50 48 46 58 C44 64 36 64 34 58 C30 48 34 40 40 28 Z"
            fill="#f2b25c"
          />
        </g>
        <path d="M12 72 L68 60" stroke="#5b4a3f" strokeWidth="7" strokeLinecap="round" />
        <path d="M12 60 L68 72" stroke="#6d5848" strokeWidth="7" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** One standing figure in its own box, feet on the bottom edge. */
const FIGURE_BOX = "-60 -196 120 202";
/** The flag bearer, with room above for the pole. */
const FLAG_BOX = "-60 -222 140 228";

export function TeamBuildingBackdrop() {
  return (
    <div
      aria-hidden
      className="team-backdrop pointer-events-none fixed inset-0 m-0 -z-10 overflow-hidden select-none"
    >
      {/* Golden hour: a pale sky warming to peach at the horizon. Night is warm charcoal. */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#eef1f1] via-[#f6efe4] to-[#f4dcc2] dark:from-[#16161d] dark:via-[#1f1c1f] dark:to-[#2e2420]" />

      {/* Soft cloud-like shapes drifting behind everything — the style's abstract filler. */}
      <div className="alegria-drift-a absolute top-[12%] -left-16 w-64 sm:w-96">
        <Blob className="w-full opacity-60 dark:opacity-20" color="#f2dcc6" />
      </div>
      <div className="alegria-drift-b absolute top-[30%] -right-20 w-72 sm:w-[28rem]">
        <Blob className="w-full rotate-45 opacity-50 dark:opacity-15" color="#d8e2d4" />
      </div>

      {clouds.map((cloud, i) => (
        <div
          key={`cloud-${i}`}
          className="sky-drift absolute left-0"
          style={{ ...driftStyle(cloud.top, cloud.duration, cloud.delay), opacity: cloud.opacity }}
        >
          <Cloud width={cloud.width} />
        </div>
      ))}

      {birds.map((bird, i) => (
        <div
          key={`bird-${i}`}
          className="sky-drift absolute left-0 text-stone-600/60 dark:text-stone-300/50"
          style={driftStyle(bird.top, bird.duration, bird.delay)}
        >
          <Bird size={bird.size} />
        </div>
      ))}

      {/* The sun setting behind the far hill. */}
      <div className="team-sun absolute bottom-[20%] left-[18%] size-32 rounded-full sm:size-44" />

      {/* Two rolling hills, then the field in front. */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[34vh] w-full"
        viewBox="0 0 1200 300"
        preserveAspectRatio="none"
      >
        <path
          d="M0 120 C200 70 380 90 560 110 C740 130 900 60 1200 90 L1200 300 L0 300 Z"
          className="fill-[#c7d1bd] dark:fill-[#2a2f27]"
        />
        <path
          d="M0 180 C220 150 420 170 640 166 C860 162 1020 140 1200 150 L1200 300 L0 300 Z"
          className="fill-[#a7b89c] dark:fill-[#232a21]"
        />
      </svg>

      {fireflies.map((fly, i) => (
        <span
          key={`fly-${i}`}
          className="team-firefly absolute block size-1.5 rounded-full"
          style={{ left: fly.left, bottom: fly.bottom, animationDelay: `${fly.delay}s` }}
        />
      ))}

      <LeafPlant className="absolute bottom-0 -left-14 h-24 opacity-90 sm:h-40 md:-left-10 md:h-[min(14rem,24vh)] md:opacity-100" />
      <LeafPlant
        className="absolute -right-12 bottom-0 hidden h-[min(16rem,26vh)] -scale-x-100 lg:block"
        colors={["#6f9479", "#8fb096", "#57806a"]}
      />

      {/* Camp on the left: tents, and someone resting by the fire. */}
      <Tent className="absolute bottom-4 left-[7%] hidden w-32 md:block" color="#b08d57" />
      <Tent className="absolute bottom-3 left-[14%] hidden w-20 lg:block" color="#8a9a7b" />
      <svg
        className="absolute bottom-2 left-[18%] hidden h-28 md:block lg:left-[20%] lg:h-32"
        viewBox="-40 -140 90 146"
      >
        <rect x="-26" y="-34" width="52" height="16" rx="8" fill="#6d5848" />
        <Figure
          pose={SIT}
          look={{ ...look(4, "bun", "long"), shirt: "#7f96c6", pants: PANTS[2] }}
        />
      </svg>
      <Campfire className="absolute bottom-3 left-[25%] hidden w-16 md:block lg:left-[27%]" />

      {/* The team — smaller on a phone, under the button. */}
      <svg
        className="alegria-hop absolute bottom-1 left-[3%] h-28 sm:bottom-2 sm:h-[min(12rem,21vh)] md:left-[33%] lg:h-[min(14rem,22vh)]"
        viewBox={FIGURE_BOX}
      >
        <Figure pose={CHEER} look={look(1, "curly")} />
      </svg>

      <svg
        className="absolute bottom-1 left-1/2 h-28 -translate-x-1/2 sm:bottom-2 sm:h-[min(12rem,21vh)] lg:h-[min(14rem,22vh)]"
        viewBox="-50 -208 190 214"
      >
        {/* A little burst where the hands meet. */}
        <g className="alegria-spark" stroke="#d9a441" strokeWidth="3" strokeLinecap="round">
          <path d="M45 -192 L45 -202 M34 -189 L28 -197 M56 -189 L62 -197" />
        </g>
        <Figure pose={HIGH_FIVE} look={look(0, "short")} />
        <g transform="translate(90 0) scale(-1 1)">
          <Figure pose={HIGH_FIVE} look={look(3, "long")} />
        </g>
      </svg>

      <svg
        className="absolute right-[3%] bottom-1 h-28 sm:bottom-2 sm:h-[min(12rem,21vh)] md:right-auto md:left-[63%] lg:h-[min(14rem,22vh)]"
        viewBox={FLAG_BOX}
      >
        <path d="M34 -218 L34 -104" stroke="#5b4a3f" strokeWidth="4" strokeLinecap="round" />
        <path className="alegria-flag" d="M36 -218 L76 -207 L36 -195 Z" fill="#c4654a" />
        <Figure pose={FLAG_BEARER} look={look(2, "short", "long")} wave="left" />
      </svg>

      {/* The tug-of-war on the right. */}
      <svg
        className="absolute right-[6%] bottom-2 hidden h-[min(11rem,18vh)] lg:block xl:right-[9%]"
        viewBox="-50 -160 272 166"
      >
        <g className="team-tug">
          <path d="M8 -97 L164 -97" stroke="#8b7355" strokeWidth="4" strokeLinecap="round" />
          <path d="M86 -97 L81 -84 L91 -84 Z" fill="#c4654a" />
          <Figure pose={PULL} look={look(5, "bun")} />
          <g transform="translate(172 0) scale(-1 1)">
            <Figure pose={PULL} look={look(6, "short", "long")} />
          </g>
        </g>
      </svg>
    </div>
  );
}
