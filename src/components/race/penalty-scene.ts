import type * as Three from "three";

import type { Kick, Outcome } from "@/lib/penalty";
import { humanRig, type HumanParts } from "./models-3d";

/**
 * The penalty spot, live in WebGL: a goal, a crowd, a shooter and a keeper
 * (the race's 3D runners) and whatever else an outcome drags onto the pitch —
 * a dog, a pigeon, a flying shoe. Unlike the race it renders every frame, but
 * there are only ever a handful of models on screen.
 *
 * Everything is a pure function of (kick, ms since the kick began): nothing is
 * simulated frame to frame, so a dropped frame, a speed-up or a skip lands on
 * exactly the picture it should.
 */

type V = [number, number, number];

const GOAL_HALF = 3.66;
const GOAL_HEIGHT = 2.44;
const NET_DEPTH = 1.8;
const SPOT: V = [0, 0.11, 11];
const CONTACT: V = [-0.42, 0, 11.35];
const KEEPER_Z = 0.35;
const KEEPER_COLOR = "#ec4899";

const INTRO_MS = 700;
/** When the fan takes the kick he stole, after the shooter would have. */
const HOOLIGAN_KICK_DELAY = 350;
/** After the verdict, how long everyone reacts before the next kick. */
const REACT_MS = 1500;
const VAR_DELAY_MS = 900;
const VAR_CHECK_MS = 1900;

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
const smooth = (u: number) => {
  const c = clamp01(u);
  return c * c * (3 - 2 * c);
};
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const lerpV = (a: V, b: V, u: number): V => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];

/** A leg of the ball's flight: from wherever the last one ended, to `to`, over `dur` ms, lofted by `arc` m. */
type Seg = { dur: number; to: V; arc?: number };

export type Verdict = { text: string; good: boolean };

export type KickScript = {
  /** When the boot meets the ball, ms from the start of the kick. */
  kickAt: number;
  /** When the first verdict is shown. */
  resolveAt: number;
  first: Verdict;
  /** VAR outcomes only: when the check starts, and what it decides. */
  varAt?: number;
  final: Verdict;
  /** When the final verdict stands. */
  finalAt: number;
  /** What the commentator says at the verdict. */
  line: string;
  duration: number;
};

const TITLES: Record<Outcome, string> = {
  corner: "VÀOOOO! ⚽",
  save: "CẢN PHÁ! 🧤",
  wide: "RA NGOÀI! 😬",
  over: "BAY LÊN TRỜI! ☁️",
  "post-out": "CỘT DỌC! 🥶",
  "post-in": "CHẠM CỘT… VÀO! 😱",
  panenka: "PANENKA! 🥄",
  "panenka-caught": "BẮT GỌN… 😐",
  whiff: "ĐÁ HỤT! 🤦",
  shoe: "GIÀY VÀO, BÓNG KHÔNG! 👟",
  dog: "CHÓ CƯỚP BÓNG! 🐕",
  pigeon: "BỒ CÂU KIẾN TẠO! 🕊️",
  pop: "BÓNG NỔ! 💥",
  sleepy: "THỦ MÔN NGỦ QUÊN TRÊN CHIẾN THẮNG! 😴",
  face: "CỨU THUA BẰNG MẶT! 🤕",
  rocket: "TÊN LỬA! 🚀",
  pinball: "BI-A! VÀOOO! 🎱",
  boomerang: "BUMERANG! 🪃",
  clones: "PHÂN THÂN! 👥",
  "var-cancel": "VÀOOOO! ⚽",
  "var-award": "CẢN PHÁ! 🧤",
  "hooligan-steal": "FAN CUỒNG CƯỚP BÓNG! 😤",
  "hooligan-shoot": "FAN SÚT HỘ… VÀO! 😤⚽",
};

function lineFor(kick: Kick, shooter: string, keeper: string): string {
  const A = shooter;
  const B = keeper;
  switch (kick.outcome) {
    case "corner":
      return `${A} sút căng vào góc, ${B} bay nhầm hướng!`;
    case "save":
      return `${B} bay người cản phá xuất thần!`;
    case "wide":
      return `${A} sút chệch cột… khá xa.`;
    case "over":
      return `${A} gửi bóng tặng khán giả hàng ghế cuối!`;
    case "post-out":
      return `Cột dọc từ chối ${A}!`;
    case "post-in":
      return `Bóng dội cột rồi lăn vào, ${B} chết lặng!`;
    case "panenka":
      return `${A} xỏ mũi ${B} bằng cú lốp bóng!`;
    case "panenka-caught":
      return `${A} lốp bóng… ${B} chỉ việc đứng bắt.`;
    case "whiff":
      return `${A} đá vào không khí và ngã ngửa!`;
    case "shoe":
      return `Giày của ${A} vào lưới rất đẹp. Tiếc là giày không tính.`;
    case "dog":
      return `Một chú chó lao vào sân cướp bóng của ${A}!`;
    case "pigeon":
      return `Bồ câu đổi hướng bóng, lừa luôn ${B}!`;
    case "pop":
      return `Bóng của ${A} nổ tung giữa không trung!`;
    case "sleepy":
      return `${B} ngủ gật, ${A} chỉ cần đẩy nhẹ.`;
    case "face":
      return `${B} cản phá… bằng mặt. Đau nhưng hiệu quả!`;
    case "rocket":
      return `Cú sút tên lửa thổi bay ${B} vào lưới!`;
    case "pinball":
      return `Cột, xà, cột… rồi vào! Vật lý đã chết!`;
    case "boomerang":
      return `Bóng bay vòng về đập trúng chính ${A}!`;
    case "clones":
      return `${B} phân thân làm ba, ${A} hết đường!`;
    case "var-cancel":
      return `VAR: "${kick.varReason}". Bàn thắng bị huỷ!`;
    case "var-award":
      return `VAR: "${kick.varReason}". Vẫn tính là bàn thắng!`;
    case "hooligan-steal":
      return `Một fan cuồng lao vào ôm bóng chạy mất, ${A} đá vào không khí!`;
    case "hooligan-shoot":
      return `Fan cuồng xô ngã ${A} rồi tự sút… trọng tài vẫn tính bàn!`;
  }
}

function runUpMs(kick: Kick): number {
  return kick.runUp === "long" ? 1150 : kick.runUp === "stutter" ? 1100 : 750;
}

/** The timing of a kick, and what is said about it. */
export function kickScript(kick: Kick, shooter: string, keeper: string): KickScript {
  const kickAt = INTRO_MS + runUpMs(kick);
  const flight: Partial<Record<Outcome, number>> = {
    panenka: 1300,
    "panenka-caught": 1300,
    whiff: 700,
    dog: 1500,
    sleepy: 2200,
    pinball: 1100,
    boomerang: 1500,
    rocket: 450,
    pigeon: 900,
    pop: 500,
    over: 800,
    "hooligan-steal": 900,
    "hooligan-shoot": HOOLIGAN_KICK_DELAY + 700,
    wide: 800,
    "post-out": 700,
    "post-in": 900,
  };
  const resolveAt = kickAt + (flight[kick.outcome] ?? 620);
  const first = { text: TITLES[kick.outcome], good: kick.outcome === "var-cancel" ? true : kick.goal };
  const line = lineFor(kick, shooter, keeper);
  if (kick.outcome === "var-cancel" || kick.outcome === "var-award") {
    const varAt = resolveAt + VAR_DELAY_MS;
    const finalAt = varAt + VAR_CHECK_MS;
    const final = {
      text: kick.goal ? "VAR: CÔNG NHẬN BÀN THẮNG ✅" : "VAR: KHÔNG CÔNG NHẬN ❌",
      good: kick.goal,
    };
    return { kickAt, resolveAt, first, varAt, final, finalAt, line, duration: finalAt + REACT_MS };
  }
  return { kickAt, resolveAt, first, final: first, finalAt: resolveAt, line, duration: resolveAt + REACT_MS };
}

/* ────────────────────────────── the models ────────────────────────────── */

function canvasTexture(THREE: typeof Three, width: number, height: number, paint: (c: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d")!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeDog(THREE: typeof Three) {
  const fur = new THREE.MeshStandardMaterial({ color: "#b7773d", roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: "#3b2414", roughness: 0.6 });
  const dog = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.55, 6, 12), fur);
  body.rotation.z = Math.PI / 2;
  body.position.y = 0.5;
  dog.add(body);
  const head = new THREE.Group();
  head.position.set(0.5, 0.72, 0);
  dog.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), fur));
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.14), fur);
  snout.position.set(0.18, -0.05, 0);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), dark);
  nose.position.set(0.29, -0.02, 0);
  head.add(nose);
  for (const z of [-0.12, 0.12]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), dark);
    ear.scale.set(0.6, 1.4, 0.5);
    ear.position.set(-0.04, 0.02, z * 1.2);
    head.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), dark);
    eye.position.set(0.14, 0.07, z * 0.6);
    head.add(eye);
  }
  const legs = [
    [0.3, 0.14],
    [0.3, -0.14],
    [-0.3, 0.14],
    [-0.3, -0.14],
  ].map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.42, z);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), fur);
    leg.position.y = -0.2;
    pivot.add(leg);
    dog.add(pivot);
    return pivot;
  });
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 8), fur);
  tail.position.set(-0.5, 0.68, 0);
  tail.rotation.z = 0.8;
  dog.add(tail);
  return { dog, legs, tail, mouth: new THREE.Vector3(0.78, 0.66, 0) };
}

function makePigeon(THREE: typeof Three) {
  const grey = new THREE.MeshStandardMaterial({ color: "#8b93a6", roughness: 0.7 });
  const neck = new THREE.MeshStandardMaterial({ color: "#4b8a7a", roughness: 0.4 });
  const pigeon = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), grey);
  body.scale.set(1.5, 1, 1);
  pigeon.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), neck);
  head.position.set(0.24, 0.1, 0);
  pigeon.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 8), new THREE.MeshStandardMaterial({ color: "#f59e0b" }));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.35, 0.09, 0);
  pigeon.add(beak);
  const wings = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.05, side * 0.12);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), grey);
    wing.scale.set(1, 0.15, 1.3);
    wing.position.z = side * 0.2;
    pivot.add(wing);
    pigeon.add(pivot);
    return { pivot, side };
  });
  return { pigeon, wings };
}

/** A person on the pitch: an outer group to move and tilt, an inner one to turn. */
function makePerson(THREE: typeof Three, color: string) {
  const rig = humanRig(THREE);
  rig.tinted[0].color.set(color);
  const place = new THREE.Group();
  const turn = new THREE.Group();
  place.add(turn);
  turn.add(rig.root);
  rig.root.traverse((node) => {
    if ((node as Three.Mesh).isMesh) node.castShadow = true;
  });
  return { rig, parts: rig.parts, place, turn };
}
type Person = ReturnType<typeof makePerson>;

/* ─────────────────────────────── the poses ─────────────────────────────── */

function armsOut(parts: HumanParts, angle: number) {
  // Arm 0 is on the rig's +z side: a negative turn about x swings it outward.
  parts.arms[0].upper.rotation.x = -angle;
  parts.arms[1].upper.rotation.x = angle;
}

function poseReady(person: Person, t: number) {
  const { rig, parts } = person;
  rig.pose({ phase: 0, mode: "stand" });
  parts.hips.position.y = 0.82;
  parts.chest.rotation.z = -0.25;
  parts.legs.forEach((leg) => {
    leg.upper.rotation.z = 0.45;
    leg.lower.rotation.z = -0.8;
  });
  armsOut(parts, 0.9 + 0.1 * Math.sin(t / 180));
  parts.arms.forEach((arm) => (arm.lower.rotation.z = 0.4));
}

function poseReach(person: Person, reach: number) {
  const { rig, parts } = person;
  rig.pose({ phase: 0, mode: "stand" });
  armsOut(parts, 0.9 + 1.9 * reach);
  parts.arms.forEach((arm) => (arm.lower.rotation.z = 0.1));
  parts.legs.forEach((leg, i) => (leg.upper.rotation.x = (i ? 1 : -1) * 0.25 * reach));
}

function poseCelebrate(person: Person, t: number) {
  const { rig, parts } = person;
  rig.pose({ phase: 0, mode: "stand" });
  parts.arms.forEach((arm, i) => {
    arm.upper.rotation.set((i ? 1 : -1) * 0.35, 0, 2.9 + 0.2 * Math.sin(t / 90 + i * 2));
    arm.lower.rotation.z = 0.2;
  });
  person.place.position.y = 0.35 * Math.abs(Math.sin(t / 160));
}

function poseSad(person: Person) {
  const { rig, parts } = person;
  rig.pose({ phase: 0, mode: "stand" });
  parts.head.rotation.z = -0.45;
  parts.chest.rotation.z = -0.15;
  parts.arms.forEach((arm, i) => {
    arm.upper.rotation.set((i ? 1 : -1) * 0.5, 0, 2.5);
    arm.lower.rotation.z = 2.0;
  });
}

function poseKick(person: Person, u: number) {
  const { rig, parts } = person;
  rig.pose({ phase: 0, mode: "stand" });
  const back = clamp01(u / 0.45);
  const through = clamp01((u - 0.45) / 0.3);
  const kickLeg = parts.legs[0];
  kickLeg.upper.rotation.z = u < 0.45 ? lerp(0.1, -0.9, back) : lerp(-0.9, 1.5, through);
  kickLeg.lower.rotation.z = u < 0.45 ? -1.6 * back : lerp(-1.6, -0.1, clamp01((u - 0.45) / 0.2));
  parts.legs[1].upper.rotation.z = 0.15;
  parts.legs[1].lower.rotation.z = -0.25;
  parts.chest.rotation.z = u < 0.45 ? 0.05 : -0.2;
  parts.arms[1].upper.rotation.set(1.3, 0, 0.3);
  parts.arms[0].upper.rotation.set(-0.6, 0, -0.6 + 1.2 * through);
}

function poseDive(person: Person, side: number, start: number, t: number, dur = 480) {
  const e = smooth((t - start) / dur);
  poseReach(person, e);
  person.place.position.x = side * 1.15 * e;
  person.place.position.y = 0.45 * Math.sin(Math.PI * clamp01((t - start) / (dur * 1.25)));
  person.place.rotation.z = -side * 1.35 * e;
}

/* ─────────────────────────────── the scene ─────────────────────────────── */

export type PenaltyScene = ReturnType<typeof createPenaltyScene>;

export function createPenaltyScene(THREE: typeof Three) {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#9fd3ff");
  scene.fog = new THREE.Fog("#9fd3ff", 45, 90);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7a3a, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  sun.position.set(7, 15, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
  scene.add(sun);

  // Pitch, mown in stripes, with its markings.
  const grass = canvasTexture(THREE, 256, 256, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? "#4f9a3c" : "#5aa845";
      c.fillRect(0, i * 32, 256, 32);
    }
  });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
  grass.repeat.set(4, 4);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);
  const chalk = new THREE.MeshBasicMaterial({ color: "#f3f7f0" });
  const line = (x1: number, z1: number, x2: number, z2: number) => {
    const w = Math.abs(x2 - x1) || 0.12;
    const d = Math.abs(z2 - z1) || 0.12;
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(w, d), chalk);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
    scene.add(mark);
  };
  line(-30, 0, 30, 0);
  line(-9.16, 0, -9.16, 5.5);
  line(9.16, 0, 9.16, 5.5);
  line(-9.16, 5.5, 9.16, 5.5);
  line(-20.15, 0, -20.15, 16.5);
  line(20.15, 0, 20.15, 16.5);
  line(-20.15, 16.5, 20.15, 16.5);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), chalk);
  spot.rotation.x = -Math.PI / 2;
  spot.position.set(SPOT[0], 0.012, SPOT[2]);
  scene.add(spot);

  // The goal: posts, bar and a net that bulges when something hits it.
  const white = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3 });
  for (const x of [-GOAL_HALF, GOAL_HALF]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_HEIGHT, 12), white);
    post.position.set(x, GOAL_HEIGHT / 2, 0);
    post.castShadow = true;
    scene.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, GOAL_HALF * 2 + 0.12, 12), white);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, GOAL_HEIGHT, 0);
  bar.castShadow = true;
  scene.add(bar);
  const netMaterial = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.55 });
  const grid = (corners: [V, V, V, V], steps: [number, number]) => {
    const [a, b, c, d] = corners;
    const points: number[] = [];
    for (let i = 0; i <= steps[0]; i++) {
      const u = i / steps[0];
      points.push(...lerpV(a, b, u), ...lerpV(d, c, u));
    }
    for (let j = 0; j <= steps[1]; j++) {
      const v = j / steps[1];
      points.push(...lerpV(a, d, v), ...lerpV(b, c, v));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return new THREE.LineSegments(geometry, netMaterial);
  };
  const net = new THREE.Group();
  const back = grid(
    [
      [-GOAL_HALF, 0, 0],
      [GOAL_HALF, 0, 0],
      [GOAL_HALF, 2.1, 0],
      [-GOAL_HALF, 2.1, 0],
    ],
    [36, 11],
  );
  back.position.z = -NET_DEPTH;
  net.add(back);
  net.add(
    grid(
      [
        [-GOAL_HALF, GOAL_HEIGHT, 0],
        [GOAL_HALF, GOAL_HEIGHT, 0],
        [GOAL_HALF, 2.1, -NET_DEPTH],
        [-GOAL_HALF, 2.1, -NET_DEPTH],
      ],
      [36, 9],
    ),
  );
  for (const x of [-GOAL_HALF, GOAL_HALF]) {
    net.add(
      grid(
        [
          [x, 0, 0],
          [x, 0, -NET_DEPTH],
          [x, 2.1, -NET_DEPTH],
          [x, GOAL_HEIGHT, 0],
        ],
        [9, 11],
      ),
    );
  }
  scene.add(net);

  // The crowd behind the goal, and the advertising boards in front of it.
  const crowd = canvasTexture(THREE, 1024, 256, (c) => {
    c.fillStyle = "#2b3140";
    c.fillRect(0, 0, 1024, 256);
    const shirts = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#ffffff", "#ec4899", "#a855f7", "#facc15"];
    for (let row = 0; row < 16; row++) {
      for (let x = 4 + (row % 2) * 6; x < 1024; x += 12) {
        c.fillStyle = shirts[Math.floor(Math.random() * shirts.length)];
        c.fillRect(x, 8 + row * 15, 7, 8);
        c.fillStyle = "#f1c09a";
        c.fillRect(x + 1, 4 + row * 15, 5, 4);
      }
    }
  });
  const stand = new THREE.Mesh(new THREE.PlaneGeometry(80, 16), new THREE.MeshBasicMaterial({ map: crowd }));
  stand.position.set(0, 9, -16);
  stand.rotation.x = -0.35;
  scene.add(stand);
  const boards = canvasTexture(THREE, 2048, 64, (c) => {
    const ads = ["CƠM TRƯA FC", "ĐUA VUI", "ĂN NO ĐÁ HAY", "VỊT ĐỘI MŨ", "BÁNH KEM BAY", "PENALTY 11M"];
    const colors = ["#1d4ed8", "#dc2626", "#059669", "#7c3aed", "#ea580c", "#0f172a"];
    let x = 0;
    for (let i = 0; x < 2048; i++) {
      c.fillStyle = colors[i % colors.length];
      c.fillRect(x, 0, 340, 64);
      c.fillStyle = "#ffffff";
      c.font = "bold 34px sans-serif";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(ads[i % ads.length], x + 170, 34);
      x += 340;
    }
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(44, 1.1), new THREE.MeshBasicMaterial({ map: boards }));
  board.position.set(0, 0.55, -5);
  scene.add(board);

  // The ball: white with dark patches, which is enough to read as a football.
  const ballTexture = canvasTexture(THREE, 256, 128, (c) => {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 256, 128);
    c.fillStyle = "#111827";
    for (const [x, y] of [
      [32, 32], [96, 20], [160, 34], [224, 22], [0, 90], [64, 96], [128, 88], [192, 100], [256, 90],
    ]) {
      c.beginPath();
      for (let k = 0; k < 5; k++) {
        const angle = (k / 5) * Math.PI * 2;
        c.lineTo(x + Math.cos(angle) * 15, y + Math.sin(angle) * 15);
      }
      c.fill();
    }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture, roughness: 0.4 }));
  ball.castShadow = true;
  scene.add(ball);

  const shooter = makePerson(THREE, "#16a34a");
  const keeper = makePerson(THREE, KEEPER_COLOR);
  const clones = [makePerson(THREE, KEEPER_COLOR), makePerson(THREE, KEEPER_COLOR)];

  // The fan: club shirt, beer belly, a scarf in the colours and a bucket hat.
  const hooligan = makePerson(THREE, "#b91c1c");
  {
    const { chest, head } = hooligan.parts;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), hooligan.rig.tinted[0]);
    belly.position.set(0.1, 0.2, 0);
    belly.scale.set(1.1, 1, 1.25);
    chest.add(belly);
    const stripes = ["#ffffff", "#dc2626"].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    for (let i = 0; i < 6; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 18, Math.PI / 3), stripes[i % 2]);
      band.rotation.set(Math.PI / 2, 0, (i * Math.PI) / 3);
      band.position.y = 0.6;
      chest.add(band);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.12), stripes[0]);
    tail.position.set(0.16, 0.42, 0.08);
    chest.add(tail);
    const hatMaterial = new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.9 });
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.14, 16), hatMaterial);
    hat.position.y = 0.14;
    head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 20), hatMaterial);
    brim.position.y = 0.08;
    head.add(brim);
  }
  for (const person of [shooter, keeper, ...clones, hooligan]) scene.add(person.place);

  const { dog, legs: dogLegs, tail: dogTail, mouth } = makeDog(THREE);
  scene.add(dog);
  const { pigeon, wings } = makePigeon(THREE);
  scene.add(pigeon);
  const shoe = new THREE.Group();
  const upper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.11), new THREE.MeshStandardMaterial({ color: "#f8fafc" }));
  shoe.add(upper);
  const soleMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: "#ef4444" }));
  soleMesh.position.y = -0.06;
  shoe.add(soleMesh);
  scene.add(shoe);
  const rag = new THREE.Mesh(new THREE.CircleGeometry(0.16, 12), new THREE.MeshStandardMaterial({ color: "#e5e7eb", side: THREE.DoubleSide }));
  scene.add(rag);

  // Bits that fly: feathers, confetti from a burst ball, smoke from a clone,
  // fire behind a rocket. Each is placed from its launch time, not simulated.
  const bits = Array.from({ length: 36 }, () => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    scene.add(mesh);
    return mesh;
  });
  type Burst = { at: number; from: V; color: string[]; speed: number; count: number; life: number; gravity: number };

  /* ── per-kick state, set by `setKick` ── */
  let kick: Kick | null = null;
  let script: KickScript | null = null;
  let segs: Seg[] = [];
  let bursts: Burst[] = [];
  let seedOf: number[] = [];
  let camShake = 0;

  const shooterStart = (): V =>
    kick?.runUp === "long" ? [-2.4, 0, 17.5] : kick?.runUp === "moonwalk" ? [-1.4, 0, 13.9] : [-1.3, 0, 13.6];

  /** Where the shooter's head is at kick time, for a boomerang to find. */
  const shooterHead: V = [CONTACT[0], 1.65, CONTACT[2]];

  function planFlight(k: Kick): Seg[] {
    const s = k.side;
    const h = k.height;
    switch (k.outcome) {
      case "corner":
      case "var-cancel":
        return [
          { dur: 600, to: [s * 2.9, 0.3 + h * 1.8, 0], arc: 0.4 },
          { dur: 250, to: [s * 3.0, 0.25, -1.5] },
        ];
      case "save":
      case "var-award":
        return [
          { dur: 580, to: [s * 2.35, 0.7 + h * 0.8, 0.35], arc: 0.3 },
          { dur: 650, to: [s * 6.5, 0.2, 4.5], arc: 0.9 },
        ];
      case "wide":
        return [
          { dur: 620, to: [s * 5.0, 0.6 + h, 0], arc: 0.4 },
          { dur: 500, to: [s * 7.2, 0.5, -5] },
        ];
      case "over":
        return [
          { dur: 650, to: [s * 1.2, 4.2, 0], arc: 0.3 },
          { dur: 900, to: [s * 2, 9, -14] },
        ];
      case "post-out":
        return [
          { dur: 560, to: [s * (GOAL_HALF - 0.12), 1.3, 0.05], arc: 0.3 },
          { dur: 650, to: [s * 5.8, 0.3, 6], arc: 0.6 },
        ];
      case "post-in":
        return [
          { dur: 560, to: [s * (GOAL_HALF - 0.12), 1.2, 0.05], arc: 0.3 },
          { dur: 400, to: [s * 1.0, 0.3, -1.4], arc: 0.2 },
        ];
      case "pinball":
        return [
          { dur: 420, to: [s * (GOAL_HALF - 0.12), 1.6, 0.05], arc: 0.2 },
          { dur: 330, to: [s * 0.8, GOAL_HEIGHT - 0.12, 0.05] },
          { dur: 330, to: [-s * (GOAL_HALF - 0.12), 1.4, 0.05] },
          { dur: 400, to: [-s * 0.5, 0.25, -1.4] },
        ];
      case "panenka":
        return [
          { dur: 1300, to: [0, 1.55, -0.2], arc: 1.8 },
          { dur: 300, to: [0, 0.3, -1.4] },
        ];
      case "panenka-caught":
        return [{ dur: 1300, to: [0, 1.25, KEEPER_Z + 0.35], arc: 1.8 }];
      case "whiff":
        return [{ dur: 1100, to: [0.1, 0.11, 10.4] }];
      case "shoe":
        return [{ dur: 700, to: [0.1, 0.11, 10.4] }];
      case "dog":
        return [{ dur: 700, to: [1.2, 0.35, 7.3], arc: 0.25 }];
      case "pigeon":
        return [
          { dur: 420, to: [s * 1.3, 3.1, 6.4], arc: 0.2 },
          { dur: 480, to: [-s * 2.3, 1.0, 0], arc: 0.2 },
          { dur: 250, to: [-s * 2.4, 0.3, -1.5] },
        ];
      case "pop":
        return [{ dur: 650, to: [s * 2.5, 1.3, 0], arc: 0.3 }];
      case "sleepy":
        return [{ dur: 2200, to: [0.35, 0.11, -1.2] }];
      case "face":
        return [
          { dur: 480, to: [0, 1.7, KEEPER_Z + 0.2], arc: 0.1 },
          { dur: 700, to: [0.6, 0.2, 8.5], arc: 1.2 },
        ];
      case "rocket":
        return [
          { dur: 250, to: [s * 0.4, 1.25, KEEPER_Z + 0.25] },
          { dur: 300, to: [s * 0.5, 1.1, -1.6] },
        ];
      case "boomerang":
        return [
          { dur: 600, to: [s * 5.5, 1.8, 4], arc: 0.5 },
          { dur: 500, to: [s * 3.5, 1.7, 13], arc: 0.3 },
          { dur: 400, to: shooterHead },
          { dur: 600, to: [CONTACT[0] + 0.8, 0.11, CONTACT[2] + 1.5], arc: 0.6 },
        ];
      case "clones":
        return [{ dur: 600, to: [s * 2.35, 1.1, KEEPER_Z + 0.35], arc: 0.3 }];
      case "hooligan-steal":
        // Never kicked: it leaves at the fan's feet (see `update`).
        return [];
      case "hooligan-shoot":
        return [
          { dur: 520, to: [s * 2.9, 0.4 + h * 1.6, 0], arc: 0.35 },
          { dur: 250, to: [s * 3.0, 0.25, -1.5] },
        ];
    }
  }

  /** When the ball is struck — by the fan, a moment late, when he took the kick. */
  const flightStart = () => (script?.kickAt ?? 0) + (kick?.outcome === "hooligan-shoot" ? HOOLIGAN_KICK_DELAY : 0);

  /** Where the ball is, and whether it has come to the end of its flight. */
  function ballAt(t: number): { at: V; leg: number; u: number; done: boolean } {
    if (!script || t < flightStart()) return { at: SPOT, leg: -1, u: 0, done: false };
    let start = flightStart();
    let from: V = SPOT;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      if (t < start + seg.dur) {
        const u = (t - start) / seg.dur;
        const p = lerpV(from, seg.to, u);
        p[1] += (seg.arc ?? 0) * 4 * u * (1 - u);
        return { at: p, leg: i, u, done: false };
      }
      start += seg.dur;
      from = seg.to;
    }
    return { at: from, leg: segs.length, u: 1, done: true };
  }

  /** When the ball goes into (or reaches the back of) the net, if it does. */
  function netHitAt(): number | null {
    if (!kick || !script) return null;
    const goalish: Outcome[] = [
      "corner", "var-cancel", "post-in", "pinball", "panenka", "pigeon", "sleepy", "rocket", "hooligan-shoot",
    ];
    if (!goalish.includes(kick.outcome)) return kick.outcome === "shoe" ? script.kickAt + 850 : null;
    return flightStart() + segs.slice(0, -1).reduce((sum, seg) => sum + seg.dur, 0) + (segs.at(-1)?.dur ?? 0) * 0.8;
  }

  function setKick(next: Kick, shooterColor: string, nextScript: KickScript) {
    kick = next;
    script = nextScript;
    segs = planFlight(next);
    shooter.rig.tinted[0].color.set(shooterColor);
    const s = next.side;
    const k = nextScript.kickAt;
    bursts = [];
    if (next.outcome === "pigeon") {
      bursts.push({ at: k + 420, from: [s * 1.3, 3.1, 6.4], color: ["#ffffff", "#cbd5e1"], speed: 2.2, count: 18, life: 1400, gravity: -1.2 });
    }
    if (next.outcome === "pop") {
      const at = ballAtRaw(k + 390);
      bursts.push({ at: k + 400, from: at, color: ["#ffffff", "#111827", "#fde047"], speed: 3.5, count: 24, life: 900, gravity: -6 });
    }
    if (next.outcome === "clones") {
      for (const x of [-2.3, 2.3]) {
        bursts.push({ at: k - 600, from: [x, 1.0, KEEPER_Z], color: ["#ffffff", "#e5e7eb"], speed: 1.4, count: 10, life: 700, gravity: 0.5 });
      }
    }
    if (next.outcome === "face") {
      bursts.push({ at: k + 480, from: [0, 1.75, KEEPER_Z + 0.2], color: ["#facc15", "#ffffff"], speed: 1.6, count: 10, life: 800, gravity: 0 });
    }
    seedOf = bits.map(() => Math.random());
    camShake = next.outcome === "rocket" ? 1 : next.goal ? 0.35 : 0;
  }

  /** `ballAt` before `setKick` finishes: used to place a burst on the flight. */
  function ballAtRaw(t: number): V {
    return ballAt(t).at;
  }

  function placeShooter(t: number) {
    if (!kick || !script) return;
    const person = shooter;
    person.place.position.set(0, 0, 0);
    person.place.rotation.set(0, 0, 0);
    const moonwalk = kick.runUp === "moonwalk";
    // Facing the goal (−z) — or, moonwalking, facing the camera.
    person.turn.rotation.y = moonwalk ? -Math.PI / 2 : Math.PI / 2;
    const start = shooterStart();
    const runStart = INTRO_MS;
    const runEnd = script.kickAt - 180;
    let u = clamp01((t - runStart) / (runEnd - runStart));
    if (kick.runUp === "stutter") {
      // Stops dead halfway, thinks about it, goes again.
      const raw = (t - runStart) / (runEnd - runStart);
      u = raw < 0.4 ? raw : raw < 0.75 ? 0.4 : 0.4 + ((raw - 0.75) / 0.25) * 0.6;
      u = clamp01(u);
    }
    const at = lerpV(start, CONTACT, u);
    person.place.position.set(at[0], 0, at[2]);
    const phase = (t / 1000) * Math.PI * 2 * 2.4 * (moonwalk ? -1 : 1);
    const running = t >= runStart && t < runEnd && !(kick.runUp === "stutter" && u === 0.4);

    const barged = kick.outcome === "hooligan-shoot" ? script.kickAt - 250 : Infinity;
    if (t >= barged) {
      // Shoulder-charged off the ball by the fan, and left on the grass.
      const u = clamp01((t - barged) / 500);
      person.turn.rotation.y = Math.PI / 2;
      person.place.position.x = lerp(at[0], at[0] - 1.3, smooth(u));
      person.rig.pose({ phase: Math.min(u, 0.5) * Math.PI, mode: "slip" });
      return;
    }
    if (t < runStart) person.rig.pose({ phase: 0, mode: "stand" });
    else if (running) person.rig.pose({ phase, mode: "run" });
    else if (t < script.kickAt + 350) {
      person.turn.rotation.y = Math.PI / 2;
      poseKick(person, clamp01((t - (script.kickAt - 200)) / 550));
    } else afterKick(t);
  }

  function afterKick(t: number) {
    if (!kick || !script) return;
    const person = shooter;
    person.turn.rotation.y = Math.PI / 2;
    const since = t - script.kickAt;
    switch (kick.outcome) {
      case "whiff":
      case "hooligan-steal": {
        // Swung at air (the ball long gone, in the second case): over backwards, legs up.
        const phase = clamp01((since - 150) / 900) * Math.PI;
        person.rig.pose({ phase: Math.min(phase, Math.PI * 0.99), mode: "slip" });
        return;
      }
      case "boomerang": {
        const hit = script.kickAt + 1500;
        if (t < hit) person.rig.pose({ phase: 0, mode: "stand" });
        else person.rig.pose({ phase: clamp01((t - hit) / 900) * Math.PI * 0.99, mode: "slip" });
        return;
      }
      case "dog": {
        // Chasing the dog off the pitch.
        const chase = t - (script.kickAt + 700);
        if (chase > 0) {
          person.turn.rotation.y = Math.PI;
          person.place.position.x = CONTACT[0] - chase * 0.006;
          person.place.position.z = lerp(CONTACT[2], 7.5, clamp01(chase / 900));
          person.rig.pose({ phase: (t / 1000) * Math.PI * 2 * 2.6, mode: "run" });
        } else person.rig.pose({ phase: 0, mode: "stand" });
        return;
      }
      case "shoe": {
        // Hopping on the one foot that still has a shoe.
        person.rig.pose({ phase: 0, mode: "stand" });
        person.parts.legs[0].upper.rotation.z = 0.6;
        person.parts.legs[0].lower.rotation.z = -1.4;
        person.place.position.y = 0.18 * Math.abs(Math.sin(t / 140));
        return;
      }
    }
    const verdict = verdictAt(t);
    if (verdict === null) person.rig.pose({ phase: 0, mode: "stand" });
    else if (verdict.good) {
      poseCelebrate(person, t);
      person.turn.rotation.y = Math.PI / 2 + Math.sin(t / 300) * 0.8;
    } else poseSad(person);
  }

  function placeKeeper(person: Person, x: number, t: number, main: boolean) {
    if (!kick || !script) return;
    person.place.position.set(x, 0, KEEPER_Z);
    person.place.rotation.set(0, 0, 0);
    person.turn.rotation.set(0, -Math.PI / 2, 0);
    const k = script.kickAt;
    const s = kick.side;
    const verdict = verdictAt(t);
    const saved = verdict !== null && !verdict.good;

    const getUpThenCelebrate = (diveSide: number, diveAt: number) => {
      const up = script!.resolveAt + 250;
      if (t < up) poseDive(person, diveSide, diveAt, t);
      else if (saved) {
        poseCelebrate(person, t);
        person.place.position.x = x + diveSide * 1.15 * (1 - smooth((t - up) / 300));
      } else poseDive(person, diveSide, diveAt, t);
    };

    if (!main) {
      // A clone: appears in a puff as the kicker winds up, then guards its side.
      const cloneSide = Math.sign(x);
      if (t < k - 600) {
        person.place.visible = false;
        return;
      }
      person.place.visible = true;
      if (t < k + 50) poseReady(person, t);
      else if (cloneSide === s) {
        poseReach(person, smooth((t - k) / 400) * 0.7);
        if (saved) poseCelebrate(person, t);
      } else if (saved) poseCelebrate(person, t);
      else poseDive(person, cloneSide, k + 60, t);
      return;
    }

    switch (kick.outcome) {
      case "corner":
      case "var-cancel":
      case "post-out":
      case "panenka":
        return t < k + 60 ? poseReady(person, t) : getUpThenCelebrate(-s, k + 60);
      case "save":
      case "var-award":
      case "wide":
      case "pigeon":
        return t < k + 40 ? poseReady(person, t) : getUpThenCelebrate(s, k + 40);
      case "post-in":
        return t < k + 250 ? poseReady(person, t) : getUpThenCelebrate(s, k + 250);
      case "over":
        poseReach(person, smooth((t - k - 200) / 300));
        person.place.position.y = t > k + 200 ? 0.5 * Math.sin(Math.PI * clamp01((t - k - 200) / 700)) : 0;
        if (t > script.resolveAt + 200) poseCelebrate(person, t);
        return;
      case "pinball":
        // Spins on the spot, following the ball round the frame.
        poseReady(person, t);
        if (t > k) person.turn.rotation.y = -Math.PI / 2 + (t - k) / 180;
        if (t > script.resolveAt) poseSad(person);
        return;
      case "panenka-caught":
        if (t < k + 1200) poseReady(person, t);
        else {
          // Caught it at the chest, then a slow, pitying shake of the head.
          poseReach(person, 0);
          person.parts.arms.forEach((arm) => arm.upper.rotation.set(0, 0, 1.3));
          person.parts.arms.forEach((arm) => (arm.lower.rotation.z = 1.2));
          person.parts.head.rotation.y = 0.4 * Math.sin(t / 150);
        }
        return;
      case "whiff":
      case "boomerang":
        // Laughing: bouncing on the spot, arms on the belly.
        if (t < k + 400) return poseReady(person, t);
        poseSad(person);
        person.parts.head.rotation.z = 0.35;
        person.place.position.y = 0.12 * Math.abs(Math.sin(t / 90));
        return;
      case "shoe":
        return t < k + 80 ? poseReady(person, t) : getUpThenCelebrate(-s, k + 80);
      case "dog":
        return t < k + 100 ? poseReady(person, t) : poseDive(person, s, k + 100, t);
      case "pop":
        if (t > k + 450) {
          poseSad(person);
          person.parts.head.rotation.z = 0.2;
        } else poseReady(person, t);
        return;
      case "sleepy":
        // Out cold on the grass for the whole kick.
        person.rig.pose({ phase: 0, mode: "stand" });
        person.place.rotation.z = 1.5;
        person.place.position.y = 0.12;
        person.place.position.x = -0.9;
        return;
      case "face": {
        const hit = k + 480;
        if (t < hit) return poseReady(person, t);
        person.rig.pose({ phase: clamp01((t - hit) / 700) * Math.PI * 0.99, mode: "slip" });
        return;
      }
      case "rocket": {
        const hit = k + 250;
        if (t < hit) return poseReady(person, t);
        // Blown back into the net with the ball, and left there.
        const u = smooth((t - hit) / 300);
        person.rig.pose({ phase: Math.min(u, 0.5) * Math.PI, mode: "slip" });
        person.place.position.z = lerp(KEEPER_Z, -1.4, u);
        person.place.position.x = s * 0.5 * u;
        return;
      }
      case "clones":
        poseReady(person, t);
        if (saved) poseCelebrate(person, t);
        return;
      case "hooligan-steal":
        if (t < k) return poseReady(person, t);
        poseSad(person);
        person.parts.head.rotation.z = 0.35;
        person.place.position.y = 0.12 * Math.abs(Math.sin(t / 90));
        return;
      case "hooligan-shoot": {
        const struck = k + HOOLIGAN_KICK_DELAY;
        return t < struck + 60 ? poseReady(person, t) : getUpThenCelebrate(-s, struck + 60);
      }
    }
  }

  function verdictAt(t: number): Verdict | null {
    if (!script || t < script.resolveAt) return null;
    return t < script.finalAt ? script.first : script.final;
  }

  function update(t: number) {
    if (!kick || !script) return;
    const s = kick.side;
    const k = script.kickAt;

    placeShooter(t);
    placeKeeper(keeper, 0, t, true);
    keeper.place.visible = true;
    clones.forEach((clone, i) => {
      if (kick!.outcome === "clones") placeKeeper(clone, i ? 2.3 : -2.3, t, false);
      else clone.place.visible = false;
    });

    // The fan, on the kicks he invades.
    let fanFoot: V | null = null;
    hooligan.place.visible = kick.outcome === "hooligan-steal" || kick.outcome === "hooligan-shoot";
    if (hooligan.place.visible) {
      const fan = hooligan;
      fan.place.rotation.set(0, 0, 0);
      fan.place.position.y = 0;
      const sprint = (t / 1000) * Math.PI * 2 * 2.8;
      if (kick.outcome === "hooligan-steal") {
        // Over the boards from the left, straight to the ball, and away right with it.
        const grab = k - 250;
        const enter = INTRO_MS + 100;
        let x: number;
        let z: number;
        if (t < grab) {
          const u = clamp01((t - enter) / (grab - enter));
          x = lerp(-13, SPOT[0] - 0.5, u);
          z = lerp(12.8, SPOT[2], u);
          fan.turn.rotation.y = -Math.atan2(SPOT[2] - 12.8, SPOT[0] - 0.5 + 13);
        } else {
          const u = clamp01((t - grab) / 2200);
          x = lerp(SPOT[0] - 0.5, 15, u);
          z = lerp(SPOT[2], 8.5, u);
          fan.turn.rotation.y = -Math.atan2(8.5 - SPOT[2], 15.5);
          fanFoot = [x + 0.55, 0.11, z - 0.05];
        }
        fan.place.position.x = x;
        fan.place.position.z = z;
        fan.rig.pose({ phase: sprint, mode: t < enter ? "stand" : "run" });
      } else {
        // In from the right, through the shooter, onto the ball — then off
        // on a lap of honour towards the camera, arms windmilling.
        const enter = INTRO_MS + 150;
        // Reaches the ball just as the shooter does, and shoulders them off it.
        const arrive = k - 250;
        const struck = k + HOOLIGAN_KICK_DELAY;
        const from: V = [12, 0, 13.5];
        if (t < arrive) {
          const at = lerpV(from, CONTACT, clamp01((t - enter) / (arrive - enter)));
          fan.place.position.set(at[0], 0, at[2]);
          // Facing where he runs: the rig looks down +x, and a turn of θ points that at (cos θ, −sin θ).
          fan.turn.rotation.y = Math.atan2(-(CONTACT[2] - from[2]), CONTACT[0] - from[0]);
          fan.rig.pose({ phase: sprint, mode: t < enter ? "stand" : "run" });
        } else if (t < struck + 450) {
          fan.place.position.set(CONTACT[0], 0, CONTACT[2]);
          fan.turn.rotation.y = Math.PI / 2;
          poseKick(fan, clamp01((t - (struck - 200)) / 550));
        } else {
          const u = (t - (struck + 450)) / 1000;
          fan.place.position.set(CONTACT[0] + Math.sin(u * 2) * 2.5, 0, CONTACT[2] + u * 2.2);
          poseCelebrate(fan, t);
          fan.turn.rotation.y = t / 120;
        }
      }
    }

    // The ball — held, carried off, burst, or in flight.
    const flight = ballAt(t);
    ball.visible = true;
    ball.scale.setScalar(1);
    let at = flight.at;
    if (kick.outcome === "panenka-caught" && flight.done) {
      at = [0, 1.25, KEEPER_Z + 0.35];
    } else if (kick.outcome === "clones" && flight.done) {
      at = [s * 2.35, 1.1, KEEPER_Z + 0.35];
    } else if (kick.outcome === "save" || kick.outcome === "var-award") {
      // Parried: nothing to do, the flight already bounces it away.
    } else if (kick.outcome === "pop" && t >= k + 390) {
      if (t < k + 400) ball.scale.setScalar(1.9);
      else ball.visible = false;
    } else if (kick.outcome === "pop" && t >= k + 250) {
      ball.scale.setScalar(1 + 0.9 * clamp01((t - (k + 250)) / 140));
    } else if (fanFoot) {
      at = fanFoot;
    } else if (kick.outcome === "dog" && t >= k + 700) {
      const mouthAt = dog.localToWorld(mouth.clone());
      at = [mouthAt.x, mouthAt.y, mouthAt.z];
    } else if (kick.outcome === "sleepy" || kick.outcome === "whiff" || kick.outcome === "shoe") {
      // Rolling along the grass.
      at = [at[0], 0.11, at[2]];
    }
    ball.position.set(...at);
    ball.rotation.x = -t / 60;
    ball.rotation.z = t / 90;

    // Fire trail: the ball's own recent positions, for a rocket.
    let bit = 0;
    const trail = kick.outcome === "rocket" && t > k && t < k + 700;
    if (trail) {
      for (let i = 1; i <= 10 && bit < bits.length; i++, bit++) {
        const past = ballAt(t - i * 22).at;
        const mesh = bits[bit];
        mesh.visible = true;
        mesh.position.set(past[0], past[1], past[2]);
        mesh.scale.setScalar(2.2 - i * 0.18);
        (mesh.material as Three.MeshBasicMaterial).color.set(i < 4 ? "#fde047" : i < 7 ? "#f97316" : "#ef4444");
      }
    }
    for (const burst of bursts) {
      const age = t - burst.at;
      for (let i = 0; i < burst.count && bit < bits.length; i++, bit++) {
        const mesh = bits[bit];
        if (age < 0 || age > burst.life) {
          mesh.visible = false;
          continue;
        }
        const seed = seedOf[bit];
        const theta = seed * Math.PI * 2 + i;
        const phi = (i / burst.count) * Math.PI;
        const speed = burst.speed * (0.6 + seed * 0.6);
        const sec = age / 1000;
        mesh.visible = true;
        mesh.position.set(
          burst.from[0] + Math.cos(theta) * Math.sin(phi) * speed * sec,
          burst.from[1] + Math.cos(phi) * speed * sec + 0.5 * burst.gravity * sec * sec,
          burst.from[2] + Math.sin(theta) * Math.sin(phi) * speed * sec,
        );
        mesh.scale.setScalar(1 - age / burst.life);
        (mesh.material as Three.MeshBasicMaterial).color.set(burst.color[i % burst.color.length]);
      }
    }
    for (; bit < bits.length; bit++) bits[bit].visible = false;

    // The net bulges where something hit it.
    const netAt = netHitAt();
    const bulge = netAt !== null && t > netAt ? Math.exp(-(t - netAt) / 350) * (kick.outcome === "rocket" ? 1.2 : 0.45) : 0;
    back.position.z = -NET_DEPTH - bulge;

    // Props, only on the kicks that need them.
    dog.visible = kick.outcome === "dog";
    if (dog.visible) {
      const enterAt = k - 700;
      const meetAt = k + 700;
      let x: number;
      if (t < meetAt) x = lerp(14, 1.6, clamp01((t - enterAt) / (meetAt - enterAt)));
      else x = lerp(1.6, -18, clamp01((t - meetAt) / 1800));
      dog.position.set(x, 0, 7.3);
      dog.rotation.y = Math.PI;
      const gallop = t / 70;
      dogLegs.forEach((leg, i) => (leg.rotation.z = 0.7 * Math.sin(gallop + (i < 2 ? 0 : Math.PI))));
      dogTail.rotation.z = 0.8 + 0.4 * Math.sin(t / 50);
      dog.position.y = 0.06 * Math.abs(Math.sin(gallop));
    }

    pigeon.visible = kick.outcome === "pigeon";
    if (pigeon.visible) {
      const hitAt = k + 420;
      const hitPoint: V = [s * 1.3, 3.1, 6.4];
      if (t < hitAt) {
        const u = (t - (hitAt - 1500)) / 1500;
        pigeon.position.set(lerp(-s * 14, hitPoint[0], u), hitPoint[1] + 0.2 * Math.sin(t / 120), hitPoint[2]);
        pigeon.rotation.set(0, s > 0 ? 0 : Math.PI, 0);
        wings.forEach(({ pivot, side }) => (pivot.rotation.x = side * 0.9 * Math.sin(t / 45)));
      } else {
        // Tumbling to the grass, then walking it off.
        const since = (t - hitAt) / 1000;
        const y = Math.max(0.18, hitPoint[1] - 4.9 * since * since);
        pigeon.position.set(hitPoint[0] + since * 0.6 * s, y, hitPoint[2]);
        pigeon.rotation.set(since * 9, 0, since * 6);
        if (y <= 0.18) pigeon.rotation.set(0, s > 0 ? 0 : Math.PI, 0.15 * Math.sin(t / 60));
      }
    }

    shoe.visible = kick.outcome === "shoe" && t > k;
    if (shoe.visible) {
      const u = clamp01((t - k) / 700);
      const p = lerpV([CONTACT[0] + 0.1, 0.2, CONTACT[2] - 0.2], [s * 2.8, 1.8, -0.4], u);
      p[1] += 1.1 * 4 * u * (1 - u);
      if (u >= 1) p[2] = lerp(-0.4, -1.4, clamp01((t - k - 700) / 250));
      shoe.position.set(...p);
      shoe.rotation.set(t / 70, t / 110, 0);
    }

    rag.visible = kick.outcome === "pop" && t > k + 400;
    if (rag.visible) {
      const since = (t - (k + 400)) / 1000;
      const burstAt = bursts[0]?.from ?? SPOT;
      rag.position.set(burstAt[0], Math.max(0.02, burstAt[1] - 3 * since * since), burstAt[2]);
      rag.rotation.set(-Math.PI / 2 + Math.sin(t / 80) * 0.5, 0, t / 200);
    }

    // The camera: behind the spot, leaning after the ball and the dog, with a
    // jolt for a goal and a big one for the rocket.
    const follow = kick.outcome === "dog" && t > k ? dog.position.x * 0.45 : at[0] * 0.25;
    const shake = camShake * (netAt !== null && t > netAt ? Math.exp(-(t - netAt) / 250) : 0);
    const push = smooth((t - k) / 900) * (kick.outcome === "boomerang" ? -2 : 1.8);
    camera.position.set(
      follow * 0.6 + Math.sin(t * 0.09) * shake * 0.25,
      3.4 + Math.cos(t * 0.11) * shake * 0.2,
      21.5 - push,
    );
    camera.lookAt(follow, 0.9, 0);
  }

  function setSize(width: number, height: number, ratio: number) {
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // A narrow screen widens the lens, so the whole goal still fits.
    camera.fov = width / height < 1.45 ? 30 : 25;
    camera.updateProjectionMatrix();
  }

  const scratch = new THREE.Vector3();
  /** Screen position (CSS px) of a world point, or null when behind the camera. */
  function project(point: Three.Vector3, width: number, height: number) {
    scratch.copy(point).project(camera);
    if (scratch.z > 1) return null;
    return { x: ((scratch.x + 1) / 2) * width, y: ((1 - scratch.y) / 2) * height };
  }

  /** Where to hang the name tags and the 💤 / 💫 over heads. */
  function anchors() {
    const head = (person: Person) => person.parts.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.35, 0));
    return { shooter: head(shooter), keeper: head(keeper), fan: hooligan.place.visible ? head(hooligan) : null };
  }

  return {
    canvas,
    render: () => renderer.render(scene, camera),
    setKick,
    update,
    setSize,
    project,
    anchors,
    dispose() {
      renderer.dispose();
      renderer.forceContextLoss();
      scene.traverse((node) => {
        const mesh = node as Three.Mesh;
        if (mesh.isMesh || (node as Three.LineSegments).isLineSegments) {
          mesh.geometry.dispose();
          const material = mesh.material as Three.Material & { map?: Three.Texture | null };
          material.map?.dispose();
          material.dispose();
        }
      });
    },
  };
}
