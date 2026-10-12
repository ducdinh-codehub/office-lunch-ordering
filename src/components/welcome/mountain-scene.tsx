import { Figure, HAIR, PANTS, SHIRTS, SKINS, STAND, type Look, type Pose } from "@/components/themes/alegria";

/*
 * The itinerary's header picture: a mountain at sunrise, a team roped
 * together climbing its ridge, and one who made it waving beside the flag on
 * the summit. Drawn in the flat "Alegria" style of the welcome backdrops.
 *
 * The scene is wider than it is tall and anchored bottom-right with `slice`,
 * so a narrow dialog crops the empty foothills on the left, never the summit.
 * Purely decorative: no pointer events, hidden from screen readers.
 *
 * Light colours are plain `fill` attributes and dark mode overrides them with
 * classes, so the same markup also draws on its own, without the page's CSS —
 * the downloadable itinerary (`drawSchedule`) renders it as an image.
 */

/** Leaning uphill to the right: front foot raised, one hand on the rope ahead. */
const CLIMB: Pose = {
  hip: [2, -76],
  neck: [16, -130],
  armL: [
    [-6, -104],
    [-4, -78],
  ],
  armR: [
    [34, -118],
    [52, -128],
  ],
  legL: [
    [-6, -38],
    [-16, -2],
  ],
  legR: [
    [20, -46],
    [24, -14],
  ],
};

const SCALE = 0.15;

/** Where each climber's feet stand — points on the main ridge, foot to summit. */
const climbers: { x: number; y: number }[] = [
  { x: 370, y: 130 },
  { x: 410, y: 110 },
  { x: 450, y: 92 },
  { x: 490, y: 62 },
];

const look = (i: number, hairStyle: Look["hairStyle"]): Look => ({
  skin: SKINS[i % SKINS.length],
  shirt: SHIRTS[(i + 1) % SHIRTS.length],
  pants: PANTS[i % PANTS.length],
  hair: HAIR[i % HAIR.length],
  hairStyle,
  sleeves: "long",
});

const HAIR_STYLES: Look["hairStyle"][] = ["short", "bun", "curly", "long"];

const SUMMIT = { x: 530, y: 32 };

// The rope runs through each climber's forward hand up to the flag's foot,
// sagging a little between them.
const hand = (c: { x: number; y: number }) =>
  [c.x + CLIMB.armR[1][0] * SCALE, c.y + CLIMB.armR[1][1] * SCALE] as const;
const ropePoints = [...climbers.map(hand), [SUMMIT.x + 6, SUMMIT.y - 1] as const];
const rope = ropePoints
  .map(([x, y], i) => {
    if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = ropePoints[i - 1];
    return `Q${((px + x) / 2).toFixed(1)} ${(Math.max(py, y) - 1).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join(" ");

export function MountainScene({
  className,
  width,
  height,
}: {
  className?: string;
  /** Pixel size, for drawing it as a picture; on a page the CSS sizes it. */
  width?: number;
  height?: number;
}) {
  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={width}
      height={height}
      viewBox="0 -14 600 164"
      preserveAspectRatio="xMaxYMax slice"
    >
      {/* The sun coming up behind the peak. */}
      <circle cx="462" cy="46" r="15" fill="#fbd38d" className="dark:fill-[#7c5a3a]" opacity="0.85" />
      <g fill="white" fillOpacity="0.7" className="dark:fill-white/15">
        <ellipse cx="400" cy="30" rx="22" ry="5" />
        <ellipse cx="414" cy="25" rx="12" ry="5" />
        <ellipse cx="576" cy="20" rx="18" ry="4" />
      </g>

      {/* Far range, then the middle one, both fading into the sky. */}
      <path
        d="M0 150 L0 122 L70 98 L130 116 L210 80 L290 108 L380 62 L470 90 L560 48 L600 64 L600 150 Z"
        fill="#f3cdb5"
        className="dark:fill-[#3a2a36]"
        opacity="0.7"
      />
      <path
        d="M120 150 L220 104 L270 118 L340 78 L400 104 L460 72 L600 96 L600 150 Z"
        fill="#e2a98f"
        className="dark:fill-[#46303d]"
        opacity="0.8"
      />

      {/* The mountain they are climbing: lit face, shadowed face, snow cap. */}
      <path
        d="M330 150 L410 110 L450 92 L490 62 L530 32 L600 85 L600 150 Z"
        fill="#9b7486"
        className="dark:fill-[#30263a]"
      />
      <path d="M530 32 L600 85 L600 150 L556 150 L548 96 Z" fill="#7d5d70"
        className="dark:fill-[#241d2e]" />
      <path
        d="M530 32 L514 44 L521 42 L527 47 L533 42 L539 45 L546 44 Z"
        fill="white"
        className="dark:fill-slate-300"
      />

      {/* The flag on top. */}
      <path d="M536 32 L536 9" stroke="#5b4636" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M536 9 L552 13.5 L536 18 Z" fill="#c4654a" />

      <path
        d={rope}
        fill="none"
        stroke="#d9a441"
        strokeWidth="1.2"
        strokeLinecap="round"
      />

      {climbers.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) scale(${SCALE})`}>
          <Figure
            pose={CLIMB}
            look={look(i, HAIR_STYLES[i % HAIR_STYLES.length])}
            behind={
              <rect
                x="-14"
                y="-130"
                width="22"
                height="42"
                rx="8"
                fill="#5b4636"
                transform="rotate(14 -3 -109)"
              />
            }
          />
        </g>
      ))}

      {/* Whoever got there first, cheering the others on. */}
      <g transform={`translate(${SUMMIT.x - 4} ${SUMMIT.y + 3}) scale(${SCALE})`}>
        <Figure pose={STAND} look={look(4, "short")} wave="left" />
      </g>
    </svg>
  );
}
