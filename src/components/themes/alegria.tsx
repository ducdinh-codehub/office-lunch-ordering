/*
 * A small kit for drawing people and plants in the flat illustration style the
 * welcome backdrops use (after "Alegria"): long legs, a small faceless head on
 * a neck, a torso that narrows from the shoulders to the waist, limbs that
 * taper from thigh to ankle and upper arm to wrist, rounded shoes, and flat
 * colour blocks with one soft shade for depth — no outlines, no gradients.
 *
 * A figure is a pose: a handful of joints in a frame where the feet stand on
 * y = 0 and up is negative. A standing figure is about 195 units tall:
 * hips at −78, the base of the neck at −134, the head's centre near −152.
 * Upper arms are about 30 long, forearms 28, thighs and shins about 38.
 */

export type Pt = readonly [number, number];

export type Pose = {
  hip: Pt;
  /** The base of the neck. */
  neck: Pt;
  /** Elbow, then hand. */
  armL: readonly [Pt, Pt];
  armR: readonly [Pt, Pt];
  /** Knee, then ankle. */
  legL: readonly [Pt, Pt];
  legR: readonly [Pt, Pt];
};

export type Look = {
  skin: string;
  shirt: string;
  pants: string;
  hair: string;
  hairStyle: "short" | "bun" | "long" | "curly";
  sleeves: "short" | "long";
};

/** Natural skin tones, flat. */
export const SKINS = ["#f0c6a2", "#c98e68", "#e2ad86", "#8e5b3e", "#f3d2b6", "#a86f4c"];
/** A muted wardrobe — friendly, not a kids' party. */
export const SHIRTS = ["#3d5a80", "#d9a441", "#7fa58a", "#c4654a", "#e7dcc6", "#7a5c7e"];
export const PANTS = ["#2b2f3a", "#3f4e6b", "#5b4636", "#4b5d55"];
export const HAIR = ["#1f1b1a", "#3b2a24", "#6b4630", "#2c2a33"];
const SHOE = "#24262e";
const SHADE = "rgb(0 0 0 / 0.08)";

const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
const scale = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
const p = (a: Pt) => `${a[0].toFixed(1)} ${a[1].toFixed(1)}`;

/** The standing pose: arms relaxed at the sides, feet a little apart. */
export const STAND: Pose = {
  hip: [0, -78],
  neck: [0, -134],
  armL: [
    [-19, -102],
    [-21, -75],
  ],
  armR: [
    [19, -102],
    [21, -75],
  ],
  legL: [
    [-8, -40],
    [-9, -4],
  ],
  legR: [
    [8, -40],
    [9, -4],
  ],
};

function Hair({ head, look, part }: { head: Pt; look: Look; part: "back" | "front" }) {
  const [x, y] = head;
  if (part === "back") {
    // Long hair falls behind the neck to the shoulders; the torso covers the rest.
    return look.hairStyle === "long" ? (
      <path
        d={`M${x - 12} ${y - 2} C${x - 14} ${y + 14} ${x - 15} ${y + 24} ${x - 11} ${y + 30} L${x + 11} ${y + 30} C${x + 15} ${y + 24} ${x + 14} ${y + 14} ${x + 12} ${y - 2} Z`}
        fill={look.hair}
      />
    ) : null;
  }
  // A cap over the crown with a fringe swept to one side.
  const cap = `M${x - 11.5} ${y + 1} C${x - 13} ${y - 16} ${x + 13} ${y - 16} ${x + 11.5} ${y + 1} L${x + 10.5} ${y - 3} C${x + 4} ${y - 9} ${x - 5} ${y - 7} ${x - 11.5} ${y + 1} Z`;
  switch (look.hairStyle) {
    case "bun":
      return (
        <g fill={look.hair}>
          <circle cx={x + 1} cy={y - 16} r="6.5" />
          <path d={cap} />
        </g>
      );
    case "curly":
      return (
        <g fill={look.hair}>
          {[
            [-10, -4],
            [-8, -11],
            [-2, -15],
            [5, -14],
            [10, -9],
            [11, -2],
          ].map(([dx, dy]) => (
            <circle key={`${dx}${dy}`} cx={x + dx} cy={y + dy} r="6" />
          ))}
        </g>
      );
    default:
      return <path d={cap} fill={look.hair} />;
  }
}

/**
 * One person. `wave` swings that arm from the shoulder; `behind` is drawn
 * before the body (a backpack), `front` after it (a camera, a map).
 */
export function Figure({
  pose,
  look,
  wave,
  behind,
  front,
}: {
  pose: Pose;
  look: Look;
  wave?: "left" | "right";
  behind?: React.ReactNode;
  front?: React.ReactNode;
}) {
  const { hip, neck } = pose;
  // `up` runs along the spine, `side` across the shoulders (towards +x when upright).
  const length = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]);
  const up: Pt = [(neck[0] - hip[0]) / length, (neck[1] - hip[1]) / length];
  const side: Pt = [-up[1], up[0]];
  const at = (from: Pt, along: number, across: number) =>
    add(add(from, scale(up, along)), scale(side, across));

  const head = at(neck, 19, 0);
  const shoulderL = at(neck, -4, -13);
  const shoulderR = at(neck, -4, 13);

  // Shoulders wider than the waist, rounded off by a stroke in the same colour.
  const torso = `M${p(at(hip, 3, -12))} L${p(at(neck, -1, -16))} Q${p(at(neck, 4, 0))} ${p(at(neck, -1, 16))} L${p(at(hip, 3, 12))} Q${p(at(hip, -2, 0))} ${p(at(hip, 3, -12))} Z`;
  const torsoShade = `M${p(at(neck, 1, 0))} L${p(at(neck, -1, 16))} L${p(at(hip, 3, 12))} L${p(at(hip, 0, 0))} Z`;

  const leg = ([knee, ankle]: readonly [Pt, Pt], dir: -1 | 1) => {
    const top = at(hip, 0, dir * 7);
    // Shoes point the way the foot went, or outward when standing square.
    const toe = Math.sign(ankle[0] - top[0]) || dir;
    return (
      <g key={dir} strokeLinecap="round" fill="none" stroke={look.pants}>
        <path d={`M${p(top)} L${p(knee)}`} strokeWidth="15" />
        <path d={`M${p(knee)} L${p(ankle)}`} strokeWidth="11" />
        <path
          d={`M${ankle[0] - toe * 5} ${ankle[1] - 1} C${ankle[0] - toe * 6} ${ankle[1] + 5} ${ankle[0] + toe * 2} ${ankle[1] + 5} ${ankle[0] + toe * 13} ${ankle[1] + 4} C${ankle[0] + toe * 15} ${ankle[1] + 1} ${ankle[0] + toe * 12} ${ankle[1] - 4} ${ankle[0] + toe * 4} ${ankle[1] - 4} Z`}
          fill={SHOE}
          stroke="none"
        />
      </g>
    );
  };

  const arm = ([elbow, hand]: readonly [Pt, Pt], shoulder: Pt, which: "left" | "right") => {
    const forearm = look.sleeves === "long" ? look.shirt : look.skin;
    // A short sleeve covers the top half of the upper arm.
    const cuff: Pt = [(shoulder[0] + elbow[0]) / 2, (shoulder[1] + elbow[1]) / 2];
    const drawn = (
      <g strokeLinecap="round" fill="none">
        {look.sleeves === "short" && (
          <path d={`M${p(cuff)} L${p(elbow)}`} stroke={look.skin} strokeWidth="8.5" />
        )}
        <path d={`M${p(elbow)} L${p(hand)}`} stroke={forearm} strokeWidth="7.5" />
        <path
          d={`M${p(shoulder)} L${p(look.sleeves === "short" ? cuff : elbow)}`}
          stroke={look.shirt}
          strokeWidth="11"
        />
        <circle cx={hand[0]} cy={hand[1]} r="5" fill={look.skin} />
      </g>
    );
    return wave === which ? (
      <g
        key={which}
        className="alegria-wave"
        style={{ transformOrigin: `${shoulder[0]}px ${shoulder[1]}px` }}
      >
        {drawn}
      </g>
    ) : (
      <g key={which}>{drawn}</g>
    );
  };

  return (
    <g>
      <Hair head={head} look={look} part="back" />
      {leg(pose.legL, -1)}
      {leg(pose.legR, 1)}
      {behind}
      {/* The neck goes under the collar. */}
      <path
        d={`M${p(at(neck, 0, 0))} L${p(at(neck, 9, 0))}`}
        stroke={look.skin}
        strokeWidth="8"
        strokeLinecap="round"
      />
      <path d={torso} fill={look.shirt} stroke={look.shirt} strokeWidth="5" strokeLinejoin="round" />
      <path d={torsoShade} fill={SHADE} />
      <ellipse
        cx={head[0]}
        cy={head[1]}
        rx="10.5"
        ry="12"
        fill={look.skin}
        transform={`rotate(${(Math.atan2(up[0], -up[1]) * 180) / Math.PI} ${p(head)})`}
      />
      <Hair head={head} look={look} part="front" />
      {arm(pose.armL, shoulderL, "left")}
      {arm(pose.armR, shoulderR, "right")}
      {front}
    </g>
  );
}

/** A tall fan of flat leaves from one base — the style's signature plant. */
export function LeafPlant({
  className,
  colors = ["#5f8a6e", "#7fa58a", "#4d7560"],
}: {
  className?: string;
  colors?: readonly [string, string, string];
}) {
  const leaves = [
    { angle: -38, length: 120, color: 0 },
    { angle: -14, length: 150, color: 1 },
    { angle: 10, length: 140, color: 2 },
    { angle: 34, length: 110, color: 0 },
    { angle: -2, length: 96, color: 2 },
  ];
  return (
    <svg className={className} viewBox="-90 -160 180 164">
      <g className="alegria-leaves">
        {leaves.map((leaf, i) => (
          <g key={i} transform={`rotate(${leaf.angle})`}>
            <path
              d={`M0 0 C-22 ${-leaf.length * 0.35} -20 ${-leaf.length * 0.8} 0 ${-leaf.length} C20 ${-leaf.length * 0.8} 22 ${-leaf.length * 0.35} 0 0 Z`}
              fill={colors[leaf.color]}
            />
            <path
              d={`M0 -4 L0 ${-leaf.length * 0.85}`}
              stroke="white"
              strokeOpacity="0.25"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** A soft organic shape for the background — the style's abstract filler. */
export function Blob({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200">
      <path
        d="M150 26 C182 40 196 78 178 104 C164 124 186 150 166 172 C142 198 96 186 66 176 C34 166 6 144 12 108 C16 84 40 76 36 52 C32 26 64 8 96 14 C116 18 128 16 150 26 Z"
        fill={color}
      />
    </svg>
  );
}
