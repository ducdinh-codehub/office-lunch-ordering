import type * as Three from "three";

/**
 * The 3D ducks and runners. Rendering a WebGL scene per runner per frame is
 * more than a phone can pay for a field of thirty, so each model is posed and
 * rendered once per animation frame and per lane colour, before the start,
 * into a sprite sheet — the race then only copies images, exactly as it does
 * for the pixel dinos. Built from primitives: no model files to load.
 */

export type ModelKind = "duck" | "human";

/**
 * Frames in each sheet, left to right: running, bursting, stumbling, throwing,
 * slipping, then one standing still. Only a human throws or slips; a duck's
 * sheet carries those frames too, so every sheet has one layout.
 */
export const RUN_FRAMES = 12;
export const BOOST_FRAMES = 12;
export const STUMBLE_FRAMES = 10;
export const THROW_FRAMES = 6;
export const SLIP_FRAMES = 10;

export type ModelFrames = {
  width: number;
  height: number;
  footX: number;
  footY: number;
  noseX: number;
  tailX: number;
  /** `lookKey(look)` → sheet */
  sheets: Map<string, HTMLCanvasElement>;
};

export type PoseMode = "run" | "boost" | "stumble" | "throw" | "slip" | "stand";
export type Pose = { phase: number; mode: PoseMode };

type Limb = { upper: Three.Group; lower: Three.Group };

/** A human's joints, for scenes that pose it beyond the race's moves. */
export type HumanParts = {
  hips: Three.Group;
  chest: Three.Group;
  head: Three.Group;
  /** Right leg first (the rig's +z side), then left. */
  legs: Limb[];
  /** Right arm first, then left. */
  arms: Limb[];
};

export type Rig = {
  root: Three.Group;
  pose: (pose: Pose) => void;
  /** What the camera frames: centre and half-height, in model units. */
  center: [number, number, number];
  halfHeight: number;
  aspect: number;
  nose: [number, number, number];
  tail: [number, number, number];
  /** Materials painted in the lane colour. */
  tinted: Three.MeshStandardMaterial[];
  parts?: HumanParts;
};

export function humanRig(THREE: typeof Three): Rig & { parts: HumanParts } {
  const mat = (color: string, roughness = 0.65) => new THREE.MeshStandardMaterial({ color, roughness });
  const shirt = mat("#16a34a");
  const skin = mat("#f1c09a");
  const shorts = mat("#1f2937");
  const hair = mat("#2b1d14", 0.9);
  const shoe = mat("#f8fafc", 0.4);
  const sole = mat("#ef4444", 0.5);
  const dark = mat("#111827", 0.3);

  const capsule = (radius: number, length: number, material: Three.Material) => {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material);
    // Hang from the pivot: the top of the capsule sits on the joint.
    mesh.position.y = -(length / 2 + radius * 0.6);
    return mesh;
  };

  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  root.add(hips);

  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.2, 16), shorts);
  hips.add(pelvis);

  const chest = new THREE.Group();
  hips.add(chest);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.34, 6, 16), shirt);
  torso.position.y = 0.3;
  torso.scale.set(0.8, 1, 1);
  chest.add(torso);
  const number = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.16), mat("#ffffff", 0.8));
  number.position.set(0.15, 0.32, 0);
  chest.add(number);

  const head = new THREE.Group();
  head.position.y = 0.78;
  chest.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin);
  head.add(skull);
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.168, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hair,
  );
  hairCap.rotation.z = 0.35;
  head.add(hairCap);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), shirt);
  band.rotation.x = Math.PI / 2;
  band.rotation.z = 0.35;
  band.position.y = 0.03;
  head.add(band);
  for (const z of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), dark);
    eye.position.set(0.145, 0.02, z);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), skin);
  nose.position.set(0.165, -0.02, 0);
  head.add(nose);

  const limb = (side: number, arm: boolean) => {
    const upper = new THREE.Group();
    const lower = new THREE.Group();
    if (arm) {
      upper.position.set(0, 0.5, side * 0.22);
      chest.add(upper);
      upper.add(capsule(0.055, 0.22, shirt));
      lower.position.y = -0.3;
      upper.add(lower);
      lower.add(capsule(0.045, 0.2, skin));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
      hand.position.y = -0.32;
      lower.add(hand);
    } else {
      upper.position.set(0, -0.05, side * 0.1);
      hips.add(upper);
      upper.add(capsule(0.075, 0.3, shorts));
      const thigh = capsule(0.065, 0.12, skin);
      thigh.position.y = -0.38;
      upper.add(thigh);
      lower.position.y = -0.45;
      upper.add(lower);
      lower.add(capsule(0.06, 0.34, skin));
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.11), shoe);
      foot.position.set(0.06, -0.47, 0);
      lower.add(foot);
      const heel = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.025, 0.115), sole);
      heel.position.set(0.06, -0.515, 0);
      lower.add(heel);
    }
    return { upper, lower };
  };
  const legs = [limb(1, false), limb(-1, false)];
  const arms = [limb(1, true), limb(-1, true)];

  const pose = ({ phase, mode }: Pose) => {
    root.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
    chest.rotation.set(0, 0, 0);
    if (mode === "stand") {
      hips.position.y = 0.95;
      chest.rotation.z = 0;
      head.rotation.z = 0;
      legs.forEach((leg, i) => {
        leg.upper.rotation.z = i ? -0.05 : 0.05;
        leg.lower.rotation.z = 0;
      });
      arms.forEach((arm, i) => {
        arm.upper.rotation.set(i ? -0.12 : 0.12, 0, 0.05);
        arm.lower.rotation.z = 0.25;
      });
      return;
    }
    if (mode === "stumble") {
      // A trip: pitch forward, arms thrown up, then scramble back upright.
      const t = phase / (Math.PI * 2);
      const fall = Math.sin(Math.PI * t);
      root.rotation.z = -1.0 * fall;
      root.position.y = -0.25 * fall;
      root.position.x = 0.2 * fall;
      hips.position.y = 0.95;
      chest.rotation.z = -0.2 * fall;
      head.rotation.z = 0.5 * fall;
      legs.forEach((leg, i) => {
        leg.upper.rotation.z = (i ? -0.9 : 0.5) * fall;
        leg.lower.rotation.z = -1.2 * fall;
      });
      arms.forEach((arm, i) => {
        arm.upper.rotation.set(0, 0, 2.4 * fall + Math.sin(t * Math.PI * 8 + i * 2) * 0.5 * fall);
        arm.lower.rotation.z = 0.4;
      });
      return;
    }
    if (mode === "slip") {
      // Feet out from under them on a peel: over backwards, legs in the air.
      const t = phase / (Math.PI * 2);
      const fall = Math.sin(Math.PI * t);
      root.rotation.z = 1.25 * fall;
      root.position.y = -0.15 * fall;
      root.position.x = -0.25 * fall;
      hips.position.y = 0.95;
      chest.rotation.z = 0.15 * fall;
      head.rotation.z = -0.3 * fall;
      legs.forEach((leg, i) => {
        leg.upper.rotation.z = (1.5 + (i ? 0.3 : -0.2)) * fall;
        leg.lower.rotation.z = -0.3 * fall;
      });
      arms.forEach((arm, i) => {
        arm.upper.rotation.set(0, 0, (i ? 2.2 : 2.8) * fall + Math.sin(t * Math.PI * 6 + i) * 0.4 * fall);
        arm.lower.rotation.z = 0.3;
      });
      return;
    }
    if (mode === "throw") {
      // Still running; the near arm winds up over the head and whips forward.
      const t = phase / (Math.PI * 2);
      const swing = t < 0.45 ? t / 0.45 : 1;
      const release = t < 0.45 ? 0 : (t - 0.45) / 0.55;
      hips.position.y = 0.95 + 0.04 * Math.abs(Math.cos(t * Math.PI * 2)) - 0.03;
      chest.rotation.z = -0.1 - 0.25 * release;
      chest.rotation.y = 0.35 * swing - 0.6 * release;
      head.rotation.z = 0.1;
      legs.forEach((leg, i) => {
        const p = t * Math.PI * 2 + i * Math.PI;
        leg.upper.rotation.z = 0.6 * Math.sin(p);
        leg.lower.rotation.z = -(0.25 + 1.1 * (0.5 - 0.5 * Math.cos(p - 0.9)));
      });
      arms[0].upper.rotation.set(0.1, 0, 3.7 * swing - 2.3 * release);
      arms[0].lower.rotation.z = 0.6 - 0.5 * release;
      arms[1].upper.rotation.set(-0.1, 0, 0.6);
      arms[1].lower.rotation.z = 1.2;
      return;
    }
    const boost = mode === "boost";
    const reach = boost ? 1.05 : 0.8;
    hips.position.y = 0.95 + (boost ? 0.07 : 0.05) * Math.abs(Math.cos(phase)) - 0.03;
    chest.rotation.z = boost ? -0.42 : -0.18;
    head.rotation.z = boost ? 0.28 : 0.12;
    legs.forEach((leg, i) => {
      const p = phase + i * Math.PI;
      leg.upper.rotation.z = reach * Math.sin(p);
      // The knee folds most as the leg swings through, least on the plant.
      leg.lower.rotation.z = -(0.25 + (boost ? 1.6 : 1.25) * (0.5 - 0.5 * Math.cos(p - 0.9)));
    });
    arms.forEach((arm, i) => {
      const p = phase + i * Math.PI;
      arm.upper.rotation.set(i ? -0.1 : 0.1, 0, -(boost ? 1.1 : 0.85) * Math.sin(p));
      arm.lower.rotation.z = 1.4;
    });
  };

  return {
    root,
    pose,
    center: [0.05, 0.95, 0],
    halfHeight: 1.12,
    aspect: 1.05,
    nose: [0.35, 0.95, 0],
    tail: [-0.3, 0.95, 0],
    tinted: [shirt],
    parts: { hips, chest, head, legs, arms },
  };
}

/**
 * The ducks come in costumes, one per lane, so a pond of them is a cast and
 * not a flock. Every look shares one body plan and one framing, so any of
 * them lines up on the same waterline.
 */
export const DUCK_LOOKS = [
  "classic",
  "shades",
  "tophat",
  "chonky",
  "longneck",
  "floatie",
  "party",
  "punk",
  "duckling",
] as const;
export type DuckLook = (typeof DUCK_LOOKS)[number];

function duckRig(THREE: typeof Three, look: DuckLook): Rig {
  const mat = (color: string, roughness = 0.45) => new THREE.MeshStandardMaterial({ color, roughness });
  const feathers = mat("#16a34a");
  const bill = mat("#fb923c", 0.35);
  const eyeWhite = mat("#ffffff", 0.2);
  const pupil = mat("#0f172a", 0.2);
  const black = mat("#111111", 0.25);

  const chonky = look === "chonky";
  const longneck = look === "longneck";
  const duckling = look === "duckling";

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 20), feathers);
  belly.scale.set(chonky ? 1.3 : 1.25, chonky ? 1.12 : duckling ? 0.85 : 0.78, chonky ? 1.15 : 0.85);
  belly.position.y = chonky ? 0.28 : 0.2;
  body.add(belly);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(chonky ? 0.12 : 0.18, 0.36, 16), feathers);
  tail.position.set(-0.6, chonky ? 0.5 : 0.42, 0);
  tail.rotation.z = 0.9;
  body.add(tail);

  // A long neck lifts the head clear of the body; a chonky duck's head sinks
  // into its shoulders; a duckling's head is too big for it.
  const headAt: [number, number] = longneck ? [0.52, 1.12] : chonky ? [0.42, 0.9] : [0.4, 0.72];
  const head = new THREE.Group();
  head.position.set(headAt[0], headAt[1], 0);
  const headScale = chonky ? 0.8 : duckling ? 1.2 : 1;
  head.scale.setScalar(headScale);
  body.add(head);
  if (longneck) {
    const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 6, 12), feathers);
    neck.position.set(0.42, 0.72, 0);
    neck.rotation.z = -0.25;
    body.add(neck);
  }
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), feathers);
  head.add(skull);
  const beak = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), bill);
  beak.scale.set(1.4, 0.45, 0.95);
  beak.position.set(0.3, -0.06, 0);
  head.add(beak);

  if (look === "shades") {
    // Too cool to look where it is going.
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.56), black);
    frame.position.set(0.24, 0.12, 0);
    head.add(frame);
    for (const z of [-0.14, 0.14]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.2), mat("#0b0b0b", 0.05));
      lens.position.set(0.25, 0.07, z);
      head.add(lens);
    }
  } else {
    // Googly eyes: big whites, small pupils looking off in slightly different directions.
    const big = duckling ? 0.1 : 0.09;
    for (const z of [-0.14, 0.14]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(big, 14, 12), eyeWhite);
      eye.position.set(0.17, 0.1, z * 1.4);
      head.add(eye);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(big * 0.45, 10, 8), pupil);
      dot.position.set(0.17 + big * 0.85, 0.1 + (z > 0 ? 0.02 : -0.015), z * 1.4 + (z > 0 ? 0.03 : -0.01));
      head.add(dot);
    }
  }

  if (look === "tophat") {
    const hat = new THREE.Group();
    hat.position.set(-0.02, 0.24, 0);
    hat.rotation.z = -0.22;
    head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 24), black);
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.32, 24), black);
    crown.position.y = 0.17;
    hat.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.06, 24), mat("#dc2626", 0.5));
    band.position.y = 0.05;
    hat.add(band);
  }
  if (look === "party") {
    const hat = new THREE.Group();
    hat.position.set(0, 0.26, 0);
    hat.rotation.z = 0.3;
    head.add(hat);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.38, 20), mat("#facc15", 0.5));
    cone.position.y = 0.17;
    hat.add(cone);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 8, 20), mat("#ec4899", 0.5));
    stripe.rotation.x = Math.PI / 2;
    stripe.position.y = 0.1;
    hat.add(stripe);
    const pompom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), mat("#ec4899", 0.8));
    pompom.position.y = 0.38;
    hat.add(pompom);
  }
  if (look === "punk") {
    // A mohawk, front to back over the crown.
    const spikes = mat("#ff2d95", 0.4);
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.24 - Math.abs(i - 2) * 0.03, 10), spikes);
      const angle = 0.75 - i * 0.37;
      spike.position.set(Math.sin(angle) * 0.29, Math.cos(angle) * 0.29, 0);
      spike.rotation.z = -angle;
      head.add(spike);
    }
  }
  if (duckling) {
    // Still wearing the egg it hatched from.
    const shell = mat("#fff7e6", 0.6);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
      shell,
    );
    cap.position.y = 0.1;
    cap.rotation.z = -0.25;
    head.add(cap);
    for (let i = 0; i < 6; i++) {
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), shell);
      const around = (i / 6) * Math.PI * 2;
      tooth.position.set(Math.cos(around) * 0.2, 0.13, Math.sin(around) * 0.2);
      tooth.rotation.set(Math.PI, 0, 0);
      cap.add(tooth);
    }
  }
  if (look === "floatie") {
    // A swim ring in red and white quarters, round the middle.
    const ring = new THREE.Group();
    ring.position.y = 0.14;
    ring.rotation.x = Math.PI / 2;
    ring.scale.set(1.2, 0.95, 1);
    body.add(ring);
    const red = mat("#ef4444", 0.3);
    const white = mat("#ffffff", 0.3);
    for (let i = 0; i < 8; i++) {
      const piece = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.13, 10, 8, Math.PI / 4), i % 2 ? red : white);
      piece.rotation.z = (i * Math.PI) / 4;
      ring.add(piece);
    }
  }

  const wings = [1, -1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.05, chonky ? 0.5 : 0.38, side * (chonky ? 0.5 : 0.36));
    body.add(pivot);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(chonky ? 0.22 : 0.3, 16, 12), feathers);
    wing.scale.set(1.2, 0.5, 0.25);
    wing.position.set(-0.15, -0.03, side * 0.03);
    pivot.add(wing);
    return { pivot, side };
  });

  // How much sillier than a plain duck this one moves: a chonky duck wobbles,
  // a long neck bobs like a pigeon's.
  const wobble = chonky ? 2.2 : 1;
  const bob = longneck ? 2.5 : duckling ? 1.6 : 1;

  const pose = ({ phase, mode }: Pose) => {
    root.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    body.position.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    head.position.set(headAt[0], headAt[1], 0);
    wings.forEach(({ pivot }) => pivot.rotation.set(0, 0, 0));
    if (mode === "stand") return;
    if (mode === "stumble" || mode === "slip") {
      // Caught in a whirlpool: a full spin, wings flung out.
      const t = phase / (Math.PI * 2);
      root.rotation.y = Math.PI * 2 * t;
      body.position.y = -0.08 * Math.sin(Math.PI * t);
      wings.forEach(({ pivot, side }) => (pivot.rotation.x = side * -1.1 * Math.sin(Math.PI * t)));
      head.rotation.z = 0.3 * Math.sin(Math.PI * 2 * t);
      return;
    }
    if (mode === "boost") {
      // Up out of the water, running on it, wings beating.
      body.position.y = 0.16 + 0.04 * Math.sin(phase * 2);
      body.rotation.z = 0.18;
      head.rotation.z = -0.25;
      head.position.x = headAt[0] + 0.05 * bob;
      wings.forEach(({ pivot, side }) => (pivot.rotation.x = side * -(0.4 + 0.9 * (0.5 + 0.5 * Math.sin(phase * 2)))));
      return;
    }
    body.position.y = 0.035 * Math.sin(phase * 2);
    body.rotation.z = 0.07 * Math.sin(phase);
    body.rotation.x = 0.06 * (wobble - 1) * Math.sin(phase);
    head.rotation.z = 0.12 * Math.sin(phase + 0.8);
    head.position.x = headAt[0] + 0.03 * bob * Math.sin(phase);
    wings.forEach(({ pivot, side }) => (pivot.rotation.x = side * -0.1 * (0.5 + 0.5 * Math.sin(phase * 2))));
  };

  return {
    root,
    pose,
    // Framed tall enough for a top hat or a long neck, so every look shares it.
    center: [0.05, 0.56, 0],
    halfHeight: 0.8,
    aspect: 1.15,
    nose: [0.85, 0.2, 0],
    tail: [-0.72, 0.2, 0],
    tinted: [feathers],
  };
}

/** Which look and colour a sheet is for; a human's look is always "default". */
export type Look = { look: string; color: string };
export const lookKey = ({ look, color }: Look) => `${look}|${color}`;

/**
 * Renders every frame of `kind` in each of `looks`, `height` CSS px tall at
 * device ratio `ratio`. Resolves `null` where WebGL is unavailable, so the
 * caller can fall back to the pixel sprites.
 */
export async function buildModelFrames(
  kind: ModelKind,
  looks: Look[],
  height: number,
  ratio: number,
): Promise<ModelFrames | null> {
  const THREE = await import("three");

  const makeRig = (look: string) => (kind === "duck" ? duckRig(THREE, look as DuckLook) : humanRig(THREE));
  // The first rig sets the framing; every look of a kind shares it.
  const first = makeRig(looks[0]?.look ?? "classic");
  const width = Math.round(height * first.aspect);
  const px = { w: Math.ceil(width * ratio), h: Math.ceil(height * ratio) };

  let renderer: Three.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(px.w, px.h, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xbfe3ff, 0.8);
  rim.position.set(-3, 2, -2);
  scene.add(rim);

  // Orthographic, from a little in front and above: the model reads as solid
  // 3D, while its size stays the same whatever the lane.
  const half = first.halfHeight;
  const camera = new THREE.OrthographicCamera(-half * first.aspect, half * first.aspect, half, -half, 0.1, 50);
  const center = new THREE.Vector3(...first.center);
  camera.position.copy(center).add(new THREE.Vector3(0.9, 1.1, 4).normalize().multiplyScalar(10));
  camera.lookAt(center);
  camera.updateMatrixWorld();

  const toScreen = (point: [number, number, number]) => {
    const v = new THREE.Vector3(...point).project(camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * height };
  };
  const foot = toScreen([0, 0, 0]);
  const nose = toScreen(first.nose);
  const tail = toScreen(first.tail);

  const poses: Pose[] = [
    ...Array.from({ length: RUN_FRAMES }, (_, i) => ({ phase: (i / RUN_FRAMES) * Math.PI * 2, mode: "run" as const })),
    ...Array.from({ length: BOOST_FRAMES }, (_, i) => ({ phase: (i / BOOST_FRAMES) * Math.PI * 2, mode: "boost" as const })),
    ...Array.from({ length: STUMBLE_FRAMES }, (_, i) => ({
      phase: ((i + 0.5) / STUMBLE_FRAMES) * Math.PI * 2,
      mode: "stumble" as const,
    })),
    ...Array.from({ length: THROW_FRAMES }, (_, i) => ({
      phase: ((i + 0.5) / THROW_FRAMES) * Math.PI * 2,
      mode: "throw" as const,
    })),
    ...Array.from({ length: SLIP_FRAMES }, (_, i) => ({
      phase: ((i + 0.5) / SLIP_FRAMES) * Math.PI * 2,
      mode: "slip" as const,
    })),
    { phase: 0, mode: "stand" as const },
  ];

  const dispose = (root: Three.Object3D) =>
    root.traverse((node) => {
      const mesh = node as Three.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        (mesh.material as Three.Material).dispose();
      }
    });

  const sheets = new Map<string, HTMLCanvasElement>();
  const byLook = new Map<string, string[]>();
  for (const { look, color } of looks) byLook.set(look, [...(byLook.get(look) ?? []), color]);

  let rig: Rig | null = first;
  for (const [look, colors] of byLook) {
    rig ??= makeRig(look);
    scene.add(rig.root);
    if (kind === "duck") {
      // Whatever is under the waterline is not drawn: the duck floats.
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.01);
      rig.root.traverse((node) => {
        const mesh = node as Three.Mesh;
        if (mesh.isMesh) (mesh.material as Three.Material).clippingPlanes = [plane];
      });
    }
    for (const color of colors) {
      for (const material of rig.tinted) material.color.set(color);
      const sheet = document.createElement("canvas");
      sheet.width = px.w * poses.length;
      sheet.height = px.h;
      const context = sheet.getContext("2d")!;
      poses.forEach((pose, i) => {
        // A duck never throws or slips: leave those frames empty.
        if (kind === "duck" && (pose.mode === "throw" || pose.mode === "slip")) return;
        rig!.pose(pose);
        renderer.render(scene, camera);
        context.drawImage(renderer.domElement, i * px.w, 0);
      });
      sheets.set(lookKey({ look, color }), sheet);
      // Let a frame through between sheets so the countdown keeps ticking.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    scene.remove(rig.root);
    dispose(rig.root);
    rig = null;
  }

  renderer.dispose();
  renderer.forceContextLoss();

  return {
    width,
    height,
    footX: foot.x,
    footY: foot.y,
    noseX: nose.x,
    tailX: tail.x,
    sheets,
  };
}

const clampIndex = (index: number, count: number) => Math.min(count - 1, Math.max(0, index));
const THROW_AT = RUN_FRAMES + BOOST_FRAMES + STUMBLE_FRAMES;
const SLIP_AT = THROW_AT + THROW_FRAMES;
const STAND_AT = SLIP_AT + SLIP_FRAMES;
/** Frames in a sheet. */
export const SHEET_FRAMES = STAND_AT + 1;

/**
 * Which frame of the sheet to draw. `index` counts strides for the cycles
 * (run, boost) and is the frame of the one-off moves (stumble, throw, slip).
 */
export function sheetFrame(mode: PoseMode, index: number): number {
  switch (mode) {
    case "run":
      return ((index % RUN_FRAMES) + RUN_FRAMES) % RUN_FRAMES;
    case "boost":
      return RUN_FRAMES + (((index % BOOST_FRAMES) + BOOST_FRAMES) % BOOST_FRAMES);
    case "stumble":
      return RUN_FRAMES + BOOST_FRAMES + clampIndex(index, STUMBLE_FRAMES);
    case "throw":
      return THROW_AT + clampIndex(index, THROW_FRAMES);
    case "slip":
      return SLIP_AT + clampIndex(index, SLIP_FRAMES);
    case "stand":
      return STAND_AT;
  }
}

/** How many frames a one-off move has. */
export function moveFrames(mode: "stumble" | "throw" | "slip"): number {
  return mode === "stumble" ? STUMBLE_FRAMES : mode === "throw" ? THROW_FRAMES : SLIP_FRAMES;
}
