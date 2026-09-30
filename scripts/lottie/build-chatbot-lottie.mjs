// Generates the "Pip" chatbot-button Lottie animations.
//   node scripts/lottie/build-chatbot-lottie.mjs
// Writes one looping file per emotion to public/lottie/chatbot/, plus
// pip-all.json holding every emotion back to back with a named marker each.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../public/lottie/chatbot");
const FR = 60;
const W = 200;
const H = 200;
const HEAD = [100, 106]; // head centre in comp space
const BASE = [100, 160]; // rig pivot: bottom of the head, so squash lands on the "floor"

const C = {
  shellTop: "#FFFFFF",
  shellBottom: "#CFD6FF",
  violet: "#7C5CFF",
  cyan: "#22D3EE",
  visor: "#0E1433",
  visorRim: "#4C5BFF",
  eye: "#6BF3FF",
  blush: "#FF6FB5",
  pink: "#FF5FA8",
  amber: "#FFC857",
  sadBlue: "#7AA8FF",
  shadow: "#1B1F3B",
  white: "#FFFFFF",
};

// ── primitives ────────────────────────────────────────────────────────────
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const rgba = (h, a = 1) => [...hex(h), a];
const S = (k) => ({ a: 0, k });
const isAnim = (v) => v && typeof v === "object" && !Array.isArray(v) && "a" in v;
const P = (v) => (isAnim(v) ? v : S(v));

const EASE = {
  io: [0.42, 0, 0.58, 1],
  soft: [0.33, 0, 0.67, 1],
  out: [0.15, 0.7, 0.35, 1],
  in: [0.6, 0, 0.85, 0.35],
  back: [0.3, 1.55, 0.55, 1],
  lin: [0, 0, 1, 1],
};

/** Keyframes: [[t, value, ease?], ...]. The ease belongs to the segment leaving that key. */
function K(keys) {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const dedup = sorted.filter((k, i) => i === 0 || k[0] !== sorted[i - 1][0]);
  return {
    a: 1,
    k: dedup.map(([t, v, e], i) => {
      const s = Array.isArray(v) ? v : [v];
      const f = { t, s };
      if (i < dedup.length - 1) {
        if (e === "hold") f.h = 1;
        else {
          const [ox, oy, ix, iy] = EASE[e || "io"];
          const n = s.length;
          f.o = { x: Array(n).fill(ox), y: Array(n).fill(oy) };
          f.i = { x: Array(n).fill(ix), y: Array(n).fill(iy) };
        }
      }
      return f;
    }),
  };
}

/** Repeat a one-period key list `times` times. */
const repeat = (keys, period, times) =>
  Array.from({ length: times }, (_, n) => keys.map(([t, v, e]) => [t + n * period, v, e])).flat();

/** rest → peak → rest pulses every `period` frames, starting at `delay`. Always spans [0, op]. */
function pulse(op, period, delay, rest, peak, rise, ease = "io") {
  const keys = [[0, rest]];
  for (let c = delay; c + 2 * rise <= op; c += period) {
    keys.push([c, rest, ease], [c + rise, peak, ease], [c + 2 * rise, rest]);
  }
  keys.push([op, rest]);
  return K(keys);
}

// Layer transforms are 3D in Lottie; pad 2D values so every player is happy.
const pad = (v, z) => (Array.isArray(v) && v.length === 2 ? [...v, z] : v);
const pad3 = (v, z) => {
  if (!isAnim(v)) return S(pad(v, z));
  return {
    a: 1,
    k: v.k.map((f) => {
      const g = { ...f, s: pad(f.s, z) };
      if (f.o && f.s.length === 2) {
        g.o = { x: [...f.o.x, f.o.x[0]], y: [...f.o.y, f.o.y[0]] };
        g.i = { x: [...f.i.x, f.i.x[0]], y: [...f.i.y, f.i.y[0]] };
      }
      return g;
    }),
  };
};
const ks = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  o: P(o),
  r: P(r),
  p: pad3(p, 0),
  a: pad3(a, 0),
  s: pad3(s, 100),
});

// ── shapes ────────────────────────────────────────────────────────────────
const tr = ({ p = [0, 0], a = [0, 0], s = [100, 100], r = 0, o = 100 } = {}) => ({
  ty: "tr", nm: "Transform", p: P(p), a: P(a), s: P(s), r: P(r), o: P(o), sk: S(0), sa: S(0),
});
const gr = (nm, it, t) => ({ ty: "gr", nm, np: it.length, it: [...it, tr(t)] });
const el = (size, p = [0, 0]) => ({ ty: "el", nm: "Ellipse", d: 1, s: P(size), p: P(p) });
const rc = (size, r, p = [0, 0]) => ({ ty: "rc", nm: "Rect", d: 1, s: P(size), p: P(p), r: P(r) });
const sh = (v, i, o, c = true) => ({
  ty: "sh", nm: "Path", d: 1,
  ks: S({ v, i: i ?? v.map(() => [0, 0]), o: o ?? v.map(() => [0, 0]), c }),
});
const col = (c) => (typeof c === "string" ? S(rgba(c)) : c);
const fl = (c, o = 100) => ({ ty: "fl", nm: "Fill", c: col(c), o: P(o), r: 1, bm: 0 });
const st = (c, w, o = 100) => ({ ty: "st", nm: "Stroke", c: col(c), o: P(o), w: P(w), lc: 2, lj: 2, ml: 4, bm: 0 });
/** stops: [[pos, hex, alpha?]]. type 1 linear, 2 radial (s = centre, e = edge). */
function gf(stops, s, e, type = 1) {
  const k = [];
  for (const [p, h] of stops) k.push(p, ...hex(h));
  for (const [p, , a = 1] of stops) k.push(p, a);
  return {
    ty: "gf", nm: "Gradient", o: S(100), r: 1, bm: 0,
    g: { p: stops.length, k: S(k) }, s: S(s), e: S(e), t: type,
    ...(type === 2 ? { h: S(0), a: S(0) } : {}),
  };
}
const glow = (color, r, alpha, t) =>
  gr("Glow", [el([r * 2, r * 2]), gf([[0, color, alpha], [0.45, color, alpha * 0.45], [1, color, 0]], [0, 0], [r, 0], 2)], t);

// Heart centred on 0,0, about 18 wide at 100%.
const heartPath = (k = 1) =>
  sh(
    [[0, 9], [-9, -3.5], [-3.5, -9], [0, -7], [3.5, -9], [9, -3.5]].map(([x, y]) => [x * k, y * k]),
    [[0, 0], [0, 6], [-3, 0], [-0.6, -1], [-1.7, 0], [0, -3]].map(([x, y]) => [x * k, y * k]),
    [[0, 0], [0, -3], [1.7, 0], [0.6, -1], [3, 0], [0, 6]].map(([x, y]) => [x * k, y * k]),
  );
// Four-point sparkle.
const sparklePath = (s) => {
  const a = s * 0.22;
  return sh([[0, -s], [a, -a], [s, 0], [a, a], [0, s], [-a, a], [-s, 0], [-a, -a]]);
};

// ── layers ────────────────────────────────────────────────────────────────
function comp() {
  const stack = []; // bottom → top
  let ind = 0;
  const push = (L) => {
    L.ind = ++ind;
    stack.push(L);
    return L.ind;
  };
  return {
    shape: (nm, shapes, t = {}, parent) =>
      push({ ddd: 0, ty: 4, nm, sr: 1, ks: ks(t), ao: 0, shapes, ip: 0, op: 0, st: 0, bm: 0, ...(parent ? { parent } : {}) }),
    nul: (nm, t = {}) => push({ ddd: 0, ty: 3, nm, sr: 1, ks: ks(t), ao: 0, ip: 0, op: 0, st: 0, bm: 0 }),
    layers: (op) => stack.map((L) => ({ ...L, op })).reverse(),
  };
}

// ── eyes & mouths (drawn in head space, 0,0 = head centre) ────────────────
const EYE_X = 21;
const EYE_Y = 2;

const roundEyes = ({ color = C.eye, size = [16, 20], blink, scaleL, scaleR } = {}) =>
  [-1, 1].map((side) =>
    gr(side < 0 ? "Eye L" : "Eye R", [
      gr("Highlight", [el([5, 5], [size[0] * 0.2, -size[1] * 0.24]), fl(C.white, 90)]),
      gr("Core", [rc(size, Math.min(...size) / 2), fl(color)]),
      glow(color, 17, 0.5),
    ], { p: [side * EYE_X, EYE_Y], s: (side < 0 ? scaleL : scaleR) ?? blink ?? [100, 100] }),
  );

const arcEyes = (color = C.eye) =>
  [-1, 1].map((side) =>
    gr(side < 0 ? "Eye L" : "Eye R", [
      sh([[-8, 4], [0, -5], [8, 4]], [[0, 0], [-5, 0], [0, -5]], [[0, -5], [5, 0], [0, 0]], false),
      st(color, 5),
      glow(color, 16, 0.4, { p: [0, 0] }),
    ], { p: [side * EYE_X, EYE_Y] }),
  );

const heartEyes = (beat) =>
  [-1, 1].map((side) =>
    gr(side < 0 ? "Eye L" : "Eye R", [
      gr("Shine", [el([4, 4], [-3.5, -4]), fl(C.white, 85)]),
      gr("Heart", [heartPath(1.25), fl(C.pink)]),
      glow(C.pink, 18, 0.55),
    ], { p: [side * EYE_X, EYE_Y], s: beat }),
  );

/** Visor-coloured lid covering the top of an eye; `tilt` > 0 drops the outer corner. */
const lids = (depth, tilt) =>
  [-1, 1].map((side) =>
    gr("Lid", [rc([34, 16], 3), fl(C.visor)], {
      p: [side * EYE_X, EYE_Y - 18 + depth],
      r: side * tilt,
    }),
  );

const smile = (w = 7, color = C.eye) =>
  gr("Smile", [sh([[-w, 0], [w, 0]], [[0, 0], [-w * 0.45, w * 0.7]], [[w * 0.45, w * 0.7], [0, 0]], false), st(color, 3.5)], { p: [0, 21] });
const frown = () =>
  gr("Frown", [sh([[-7, 3], [7, 3]], [[0, 0], [-3, -5]], [[3, -5], [0, 0]], false), st(C.sadBlue, 3.5)], { p: [0, 21] });
const bigSmile = () =>
  gr("Big smile", [
    gr("Tongue", [el([9, 5], [0, 5.5]), fl(C.blush)]),
    gr("Mouth", [sh([[-11, -1], [11, -1], [0, 10]], [[0, 7], [0, 0], [6, 0]], [[0, 0], [0, 7], [-6, 0]]), fl(C.eye)]),
  ], { p: [0, 19] });

// ── the bot ───────────────────────────────────────────────────────────────
function bot({
  op,
  rig = {},
  shadow = {},
  antenna = {},
  eyes,
  eyesT = {},
  mouth,
  mouthT = {},
  blush = 30,
  back = () => {},
  front = () => {},
}) {
  const L = comp();

  L.shape("Shadow", [gr("Shadow", [el([84, 12]), fl(C.shadow, 100)])], {
    p: [100, 184], s: shadow.s ?? [100, 100], o: shadow.o ?? 18,
  });
  back(L);

  const rigId = L.nul("Rig", { a: BASE, p: rig.p ?? BASE, s: rig.s ?? [100, 100], r: rig.r ?? 0 });
  const child = (nm, shapes, t = {}) => L.shape(nm, shapes, { p: HEAD, ...t }, rigId);

  const orb = antenna.color ?? C.cyan;
  child("Antenna", [
    gr("Orb", [
      gr("Spark", [el([4, 4], [-2, -2]), fl(C.white, 95)]),
      gr("Core", [el([13, 13]), fl(orb)]),
      glow(orb, 18, 0.6, { s: antenna.pulse ?? [100, 100], o: antenna.glowO ?? 100 }),
    ], { p: [0, -23] }),
    gr("Stem", [sh([[0, 0], [0, -17]], null, null, false), st("#B9C2FF", 4)]),
    gr("Socket", [el([16, 7]), fl("#AEB8FF")]),
  ], { p: [HEAD[0], HEAD[1] - 52], r: antenna.r ?? 0 });

  child("Shell", [
    gr("Shell gloss", [el([62, 12]), fl(C.white, 85)], { p: [-12, -42], r: -6 }),
    gr("Visor", [
      gr("Visor sheen", [rc([26, 4], 2), fl(C.white, 9)], { p: [-22, -23], r: -6 }),
      gr("Visor glass", [rc([98, 66], 30), st(C.visorRim, 2, 55), fl(C.visor)]),
    ], { p: [0, 4] }),
    gr("Head", [
      rc([128, 108], 48),
      gf([[0, C.shellTop], [1, C.shellBottom]], [0, -54], [0, 54]),
    ]),
    ...[-1, 1].map((side) =>
      gr("Ear", [
        gr("Ear light", [el([5, 5], [side * 2, -6]), fl(C.white, 70)]),
        gr("Ear pod", [rc([16, 34], 8), gf([[0, C.violet], [1, C.cyan]], [0, -17], [0, 17])]),
      ], { p: [side * 64, 6] }),
    ),
  ]);

  child("Blush", [-1, 1].map((side) => gr("Cheek", [el([14, 7]), fl(C.blush)], { p: [side * 35, 17] })), { o: blush });
  child("Eyes", eyes, { ...eyesT, p: eyesT.p ?? HEAD });
  child("Mouth", mouth, { ...mouthT, p: mouthT.p ?? HEAD });
  front(L, rigId);

  return { layers: L.layers(op), op };
}

// ── emotions ──────────────────────────────────────────────────────────────
const blinkKeys = (op, ...at) =>
  K([[0, [100, 100]], ...at.flatMap((t) => [[t, [100, 100]], [t + 5, [100, 8]], [t + 11, [100, 100]]]), [op, [100, 100]]]);

function idle() {
  const op = 180;
  return bot({
    op,
    rig: {
      p: K([[0, BASE, "soft"], [90, [100, 153], "soft"], [180, BASE]]),
      r: K([[0, 0, "soft"], [45, -2.5, "soft"], [135, 2.5, "soft"], [180, 0]]),
    },
    shadow: { s: K([[0, [100, 100], "soft"], [90, [84, 84], "soft"], [180, [100, 100]]]), o: K([[0, 18, "soft"], [90, 11, "soft"], [180, 18]]) },
    antenna: {
      r: K([[0, 0, "soft"], [55, 5, "soft"], [145, -5, "soft"], [180, 0]]),
      pulse: K([[0, [80, 80], "soft"], [90, [125, 125], "soft"], [180, [80, 80]]]),
    },
    eyes: roundEyes({ blink: blinkKeys(op, 128, 146) }),
    eyesT: {
      p: K([[0, HEAD], [38, HEAD, "out"], [48, [104, 105]], [78, [104, 105], "out"], [88, [96, 106]], [112, [96, 106], "out"], [122, HEAD], [180, HEAD]]),
    },
    mouth: [smile()],
    mouthT: { p: K([[0, HEAD], [38, HEAD, "out"], [48, [103, 106]], [78, [103, 106], "out"], [88, [97, 106]], [112, [97, 106], "out"], [122, HEAD], [180, HEAD]]) },
    blush: 30,
  });
}

function happy() {
  const op = 120;
  const hop = [
    [0, BASE], [9, [100, 161], "out"], [27, [100, 146], "in"], [45, BASE], [60, BASE],
  ];
  const squash = [
    [0, [100, 100]], [9, [111, 89], "out"], [18, [93, 108]], [27, [100, 100]], [44, [103, 97], "out"], [50, [110, 90]], [60, [100, 100]],
  ];
  const sparkle = (L, [x, y], delay, size) =>
    L.shape("Sparkle", [gr("Sparkle", [sparklePath(size), fl(C.amber)])], {
      p: [x, y],
      s: K([[0, [0, 0]], [delay, [0, 0], "back"], [delay + 14, [110, 110]], [delay + 30, [0, 0]], [op, [0, 0]]]),
      r: K([[0, 0], [delay, 0, "lin"], [delay + 30, 90], [op, 90]]),
    });
  return bot({
    op,
    rig: {
      p: K(repeat(hop, 60, 2).concat([[120, BASE]])),
      s: K(repeat(squash, 60, 2).concat([[120, [100, 100]]])),
      r: K([[0, -4, "soft"], [60, 4, "soft"], [120, -4]]),
    },
    shadow: {
      s: K(repeat([[0, [100, 100]], [9, [108, 108], "out"], [27, [74, 74], "in"], [45, [100, 100]]], 60, 2).concat([[120, [100, 100]]])),
    },
    antenna: {
      r: K(repeat([[0, 0], [12, -10], [27, 8], [42, -6], [52, 5], [60, 0]], 60, 2)),
      pulse: pulse(op, 60, 0, [90, 90], [135, 135], 14),
    },
    eyes: arcEyes(),
    mouth: [bigSmile()],
    blush: 75,
    front: (L) => {
      sparkle(L, [34, 58], 4, 9);
      sparkle(L, [168, 52], 26, 7);
      sparkle(L, [164, 146], 52, 8);
      sparkle(L, [38, 138], 78, 6);
    },
  });
}

function thinking() {
  const op = 150;
  const look = [[0, [105, 101]], [60, [105, 101], "out"], [70, [95, 101]], [112, [95, 101], "out"], [122, [105, 101]], [150, [105, 101]]];
  return bot({
    op,
    rig: {
      p: K([[0, BASE, "soft"], [75, [100, 155], "soft"], [150, BASE]]),
      r: K([[0, 6, "soft"], [75, 3, "soft"], [150, 6]]),
    },
    shadow: { s: K([[0, [100, 100], "soft"], [75, [90, 90], "soft"], [150, [100, 100]]]) },
    antenna: {
      color: C.amber,
      r: K([[0, 6, "soft"], [75, 10, "soft"], [150, 6]]),
      pulse: pulse(op, 30, 0, [70, 70], [140, 140], 15, "soft"),
    },
    eyes: [...lids(4, -6).slice(0, 1), ...roundEyes({ scaleL: [100, 72], scaleR: [100, 100] })],
    eyesT: { p: K(look) },
    mouth: [gr("Hmm", [sh([[-5, 0], [0, 1], [5, -1]], [[0, 0], [-2, 0], [-2, 1]], [[2, 1], [2, 0], [0, 0]], false), st(C.eye, 3.5)], { p: [4, 22] })],
    mouthT: { p: K(look.map(([t, [x], e]) => [t, [x, 106], e])) },
    blush: 20,
    front: (L) => {
      L.shape("Thought bubble", [
        gr("Dot", [el([5, 5], [-20, 27]), fl(C.white, 92)]),
        gr("Dot", [el([8, 8], [-12, 18]), fl(C.white, 92)]),
        ...[-11, 0, 11].map((x, i) =>
          gr("Think dot", [el([6.5, 6.5]), fl(C.violet)], {
            p: [x, 0],
            s: pulse(op, 50, i * 10, [70, 70], [120, 120], 10),
            o: pulse(op, 50, i * 10, 45, 100, 10),
          }),
        ),
        gr("Bubble", [rc([44, 22], 11), st(C.shellBottom, 2), fl(C.white, 95)]),
      ], {
        p: [166, 30],
        s: K([[0, [100, 100], "soft"], [75, [106, 106], "soft"], [150, [100, 100]]]),
      });
    },
  });
}

function talking() {
  const op = 120;
  const heights = [4, 11, 6, 13, 5, 9, 12, 4, 10, 7, 13, 5, 8, 11, 4];
  const mouthSize = K(heights.map((h, i) => [i * 8, [12 + h * 0.35, h]]).concat([[op, [12 + 4 * 0.35, 4]]]));
  return bot({
    op,
    rig: {
      p: K([[0, BASE, "soft"], [30, [100, 157], "soft"], [60, BASE, "soft"], [90, [100, 157], "soft"], [120, BASE]]),
      r: K([[0, -2, "soft"], [60, 2, "soft"], [120, -2]]),
    },
    antenna: { r: K([[0, -3, "soft"], [60, 3, "soft"], [120, -3]]), pulse: pulse(op, 20, 0, [85, 85], [120, 120], 10, "soft") },
    eyes: roundEyes({ blink: blinkKeys(op, 84) }),
    mouth: [gr("Speaking", [el(mouthSize), fl(C.eye), glow(C.eye, 12, 0.35)], { p: [0, 22] })],
    blush: 35,
    front: (L) =>
      [0, 1, 2].forEach((i) =>
        L.shape("Sound wave", [gr("Arc", [
          sh([[0, -10], [0, 10]], [[0, 0], [8, 0]], [[8, 0], [0, 0]], false),
          st(C.cyan, 3),
        ])], {
          p: [178, 100],
          s: pulse(op, 40, i * 13, [60, 60], [150, 150], 20, "out"),
          o: pulse(op, 40, i * 13, 0, 80, 20, "out"),
        }),
      ),
  });
}

function surprised() {
  const op = 120;
  return bot({
    op,
    rig: {
      p: K([[0, BASE], [6, [100, 162], "out"], [22, [100, 144], "in"], [40, BASE], [48, [100, 161]], [56, BASE], [120, BASE]]),
      s: K([[0, [100, 100]], [6, [110, 90], "out"], [14, [92, 110]], [22, [100, 100]], [40, [108, 92], "out"], [50, [98, 102]], [58, [100, 100]], [120, [100, 100]]]),
    },
    shadow: { s: K([[0, [100, 100]], [6, [106, 106], "out"], [22, [70, 70], "in"], [40, [100, 100]], [120, [100, 100]]]) },
    antenna: {
      r: K([[0, 0], [14, -20], [26, 15], [36, -10], [46, 6], [56, -3], [66, 0], [120, 0]]),
      pulse: K([[0, [90, 90]], [14, [160, 160], "out"], [60, [100, 100]], [120, [90, 90]]]),
    },
    eyes: roundEyes({
      size: [18, 18],
      blink: K([[0, [100, 100]], [6, [80, 70]], [16, [140, 140], "back"], [90, [135, 135], "soft"], [112, [100, 100]], [120, [100, 100]]]),
    }),
    mouth: [gr("Oh", [el([9, 11]), st(C.eye, 3.5)], {
      p: [0, 23],
      s: K([[0, [60, 60]], [10, [60, 60], "back"], [22, [115, 125]], [90, [110, 120], "soft"], [112, [60, 60]], [120, [60, 60]]]),
    })],
    blush: 20,
    front: (L) =>
      L.shape("Exclaim", [
        gr("Dot", [el([7, 7], [0, 12]), fl(C.amber)]),
        gr("Bar", [rc([7, 18], 3.5, [0, -6]), fl(C.amber)]),
      ], {
        p: [160, 42],
        r: 14,
        s: K([[0, [0, 0]], [12, [0, 0], "back"], [24, [115, 115]], [34, [100, 100]], [96, [100, 100], "in"], [110, [0, 0]], [120, [0, 0]]]),
      }),
  });
}

function sad() {
  const op = 180;
  const lowered = [100, 165];
  const tearStart = [HEAD[0] - EYE_X, HEAD[1] + 22];
  return bot({
    op,
    rig: {
      p: K([[0, lowered, "soft"], [90, [100, 168], "soft"], [180, lowered]]),
      s: K([[0, [101, 99], "soft"], [90, [103, 97], "soft"], [180, [101, 99]]]),
      r: K([[0, 3, "soft"], [90, 1, "soft"], [180, 3]]),
    },
    shadow: { s: [104, 104], o: 22 },
    antenna: {
      color: C.sadBlue,
      glowO: 55,
      r: K([[0, 22, "soft"], [90, 26, "soft"], [180, 22]]),
      pulse: K([[0, [70, 70], "soft"], [90, [90, 90], "soft"], [180, [70, 70]]]),
    },
    eyes: [...lids(7, 18), ...roundEyes({ color: C.sadBlue, blink: blinkKeys(op, 150) })],
    eyesT: { p: [100, 110] },
    mouth: [frown()],
    mouthT: { p: [100, 108] },
    blush: 0,
    front: (L) =>
      L.shape("Tear", [gr("Tear", [
        gr("Shine", [el([2.5, 4], [-1.5, 1]), fl(C.white, 80)]),
        gr("Drop", [sh([[0, -8], [5, 2], [0, 7], [-5, 2]], [[-1.5, 3], [0, -3], [3, 0], [0, 3]], [[1.5, 3], [0, 3], [-3, 0], [0, -3]]), fl("#8FD3FF")]),
      ])], {
        p: K([[0, tearStart], [40, tearStart, "in"], [85, [tearStart[0] - 2, 176]], [180, [tearStart[0] - 2, 176]]]),
        s: K([[0, [0, 0]], [10, [0, 0], "out"], [38, [100, 100]], [85, [85, 110]], [180, [85, 110]]]),
        o: K([[0, 100], [70, 100], [85, 0], [180, 0]]),
      }),
  });
}

function love() {
  const op = 120;
  const beat = [[0, [100, 100]], [8, [124, 124], "out"], [18, [100, 100]], [26, [116, 116], "out"], [36, [100, 100]], [60, [100, 100]]];
  const floatHeart = (L, x0, delay, drift, size) =>
    L.shape("Floating heart", [gr("Heart", [heartPath(size), fl(C.pink)])], {
      p: K([[0, [x0, 96]], [delay, [x0, 96], "soft"], [delay + 30, [x0 + drift, 60], "soft"], [delay + 60, [x0 - drift * 0.4, 18]], [op, [x0 - drift * 0.4, 18]]]),
      s: K([[0, [0, 0]], [delay, [0, 0], "back"], [delay + 14, [100, 100]], [delay + 60, [70, 70]], [op, [70, 70]]]),
      o: K([[0, 0], [delay, 0], [delay + 8, 100], [delay + 42, 100], [delay + 60, 0], [op, 0]]),
      r: K([[0, 0], [delay, -12, "soft"], [delay + 30, 12, "soft"], [delay + 60, -8], [op, -8]]),
    });
  return bot({
    op,
    rig: {
      p: K([[0, BASE, "soft"], [60, [100, 153], "soft"], [120, BASE]]),
      r: K([[0, -5, "soft"], [60, 5, "soft"], [120, -5]]),
    },
    shadow: { s: K([[0, [100, 100], "soft"], [60, [86, 86], "soft"], [120, [100, 100]]]) },
    antenna: {
      color: C.pink,
      r: K([[0, 6, "soft"], [60, -6, "soft"], [120, 6]]),
      pulse: K(repeat(beat, 60, 2)),
    },
    eyes: heartEyes(K(repeat(beat, 60, 2))),
    mouth: [smile(6)],
    blush: 85,
    back: (L) => {
      floatHeart(L, 36, 0, 8, 0.9);
      floatHeart(L, 164, 30, -8, 1.1);
    },
    front: (L) => floatHeart(L, 150, 60, 10, 0.75),
  });
}

// ── write ─────────────────────────────────────────────────────────────────
const EMOTIONS = { idle, happy, thinking, talking, surprised, sad, love };

const doc = (nm, op, layers, markers = []) => ({
  v: "5.7.4", fr: FR, ip: 0, op, w: W, h: H, nm, ddd: 0, assets: [], layers, markers,
});

mkdirSync(OUT, { recursive: true });
const built = Object.entries(EMOTIONS).map(([name, make]) => ({ name, ...make() }));

for (const { name, op, layers } of built) {
  writeFileSync(join(OUT, `pip-${name}.json`), JSON.stringify(doc(`Pip ${name}`, op, layers)));
}

// Combined: each emotion's layers shifted onto its own stretch of the timeline.
let offset = 0;
let indBase = 0;
const allLayers = [];
const markers = [];
for (const { name, op, layers } of built) {
  const maxInd = Math.max(...layers.map((l) => l.ind));
  for (const l of layers) {
    allLayers.push({
      ...l,
      ind: l.ind + indBase,
      ...(l.parent ? { parent: l.parent + indBase } : {}),
      ip: offset,
      op: offset + op,
      st: offset,
    });
  }
  markers.push({ tm: offset, cm: name, dr: op });
  offset += op;
  indBase += maxInd;
}
writeFileSync(join(OUT, "pip-all.json"), JSON.stringify(doc("Pip", offset, allLayers, markers)));

console.log(`wrote ${built.length + 1} files to ${OUT}`);
for (const { name, op } of built) console.log(`  pip-${name}.json  ${op}f / ${(op / FR).toFixed(1)}s`);
