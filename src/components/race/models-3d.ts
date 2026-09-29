import type * as Three from "three";

/**
 * The 3D ducks and runners. Rendering a WebGL scene per runner per frame is
 * more than a phone can pay for a field of thirty, so each model is posed and
 * rendered once per animation frame and per lane colour, before the start,
 * into a sprite sheet — the race then only copies images, exactly as it does
 * for the pixel dinos. Built from primitives: no model files to load.
 */

export type ModelKind = "duck" | "human" | "swimmer" | "horse";

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
  /** The top of the standing head, in CSS px from the frame's top-left. */
  headX: number;
  headY: number;
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
  /** The top of the head, standing: where icons and the crown go. */
  head: [number, number, number];
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
    head: [0.02, 1.92, 0],
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
    head: [0.4, 1.05, 0],
    tinted: [feathers],
  };
}

/* ───────────────────────────── the swimmer ───────────────────────────── */

/**
 * A human doing front crawl: the race's runner, laid flat in the water in a
 * cap and goggles. The waterline is y = 0 and everything under it is clipped,
 * so what shows is a back, a head turning to breathe and arms coming over.
 */
/** How high a swimmer's spine rides, relative to the waterline, and its head-up tilt. */
const SWIM_DEPTH = -0.1;
const SWIM_TILT = 0.07;

function swimmerRig(THREE: typeof Three): Rig {
  const human = humanRig(THREE);
  const { hips, chest, head, legs, arms } = human.parts;

  // Dressed for the pool: the runner's shirt, number and headband come off,
  // the running shoes too, and the shorts become jammers in the lane colour.
  const lane = human.tinted[0];
  const skin = (head.children[0] as Three.Mesh).material as Three.MeshStandardMaterial;
  const shorts = (hips.children[0] as Three.Mesh).material as Three.MeshStandardMaterial;
  human.root.traverse((node) => {
    const mesh = node as Three.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as Three.MeshStandardMaterial;
    const hex = material.color.getHexString();
    if (material === lane) {
      // The headband is the one lane-coloured thing on the head; the rest was the shirt.
      if (mesh.parent === head) mesh.visible = false;
      else mesh.material = skin;
    } else if (material === shorts) mesh.material = lane;
    else if (hex === "ffffff") mesh.visible = false; // the race number
    else if (hex === "f8fafc") mesh.material = skin; // the shoes: bare feet
    else if (hex === "ef4444") mesh.visible = false; // the soles
  });
  // Shoulders and flattened hands, the swimmer's shape.
  for (const z of [-0.23, 0.23]) {
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), skin);
    deltoid.position.set(0, 0.5, z);
    chest.add(deltoid);
  }
  arms.forEach(({ lower }) => {
    const hand = lower.children.find((child) => (child as Three.Mesh).isMesh && child.position.y < -0.3);
    hand?.scale.set(1.35, 0.8, 0.55);
  });
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.02, 6, 24, Math.PI), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }));
  stripe.rotation.set(0, Math.PI / 2, 0);
  stripe.position.y = 0.04;
  head.add(stripe);

  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    human.tinted[0],
  );
  cap.position.y = 0.01;
  head.add(cap);
  const black = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.2 });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.018, 6, 24), black);
  strap.rotation.x = Math.PI / 2;
  strap.position.y = 0.02;
  head.add(strap);
  for (const z of [-0.065, 0.065]) {
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshStandardMaterial({ color: "#38bdf8", roughness: 0.05 }));
    lens.scale.set(0.6, 0.8, 1);
    lens.position.set(0.15, 0.03, z);
    head.add(lens);
  }

  // White water on the surface: a bow wave at the head, foam boiling at the
  // feet, splashes where the hands go in. It lives beside the swimmer, not in
  // it, since the swimmer is turned on its side and the water is not.
  const outer = new THREE.Group();
  outer.add(human.root);
  const foamMaterial = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.3, transparent: true, opacity: 0.85 });
  const blob = (r: number) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), foamMaterial);
    mesh.scale.y = 0.45;
    outer.add(mesh);
    return mesh;
  };
  const bow = [blob(0.12), blob(0.09), blob(0.08)];
  const wake = [blob(0.13), blob(0.1), blob(0.11), blob(0.08)];
  const entry = [blob(0.1), blob(0.1)];
  const ring = Array.from({ length: 8 }, () => blob(0.07));
  const allFoam = [...bow, ...wake, ...entry, ...ring];

  const foam = (phase: number, mode: Pose["mode"]) => {
    allFoam.forEach((mesh) => (mesh.visible = false));
    const pulse = (k: number) => 0.7 + 0.35 * Math.sin(phase * 3 + k);
    if (mode === "stand" || mode === "stumble") {
      // A ring of ripples round someone treading water — thrashing, in a cramp.
      const thrash = mode === "stumble" ? 1.8 : 1;
      ring.forEach((mesh, i) => {
        const angle = (i / ring.length) * Math.PI * 2 + phase * 0.3;
        mesh.visible = true;
        mesh.position.set(Math.cos(angle) * 0.42 * thrash, 0, Math.sin(angle) * 0.3 * thrash);
        mesh.scale.set(pulse(i) * thrash, 0.45, pulse(i) * thrash);
      });
      return;
    }
    const strength = mode === "boost" ? 1.5 : 1;
    bow.forEach((mesh, i) => {
      mesh.visible = true;
      mesh.position.set(1.05 - i * 0.12, 0, (i - 1) * 0.2);
      mesh.scale.set(pulse(i) * strength, 0.45, pulse(i) * strength);
    });
    wake.forEach((mesh, i) => {
      mesh.visible = true;
      mesh.position.set(-0.95 - (i % 2) * 0.15, 0, (i - 1.5) * 0.12);
      mesh.scale.set(pulse(i * 2) * strength, 0.45 + 0.2 * Math.abs(Math.sin(phase * 3 + i)), pulse(i * 2) * strength);
    });
    entry.forEach((mesh, i) => {
      // A burst of spray just as each hand goes in, in front of the head.
      const sinceEntry = ((phase + (mode === "boost" ? 0 : i * Math.PI)) % (Math.PI * 2)) / (Math.PI * 2);
      if (sinceEntry > 0.3) return;
      mesh.visible = true;
      mesh.position.set(1.25, 0, (i ? -1 : 1) * 0.22);
      const grow = 0.6 + (sinceEntry / 0.3) * 0.9;
      mesh.scale.set(grow * strength, 0.45 + sinceEntry * 1.5, grow * strength);
    });
  };

  const pose = ({ phase, mode }: Pose) => {
    human.pose({ phase: 0, mode: "stand" });
    foam(phase, mode);
    const { root } = human;
    if (mode === "stand") {
      // Treading water: upright, shoulders out, hands sculling.
      root.position.set(0, -1.22 + 0.04 * Math.sin(phase * 2), 0);
      arms.forEach((arm, i) => {
        arm.upper.rotation.set((i ? 1 : -1) * 1.2, 0, 0.3);
        arm.lower.rotation.z = 0.5;
      });
      legs.forEach((leg, i) => (leg.upper.rotation.z = 0.4 * Math.sin(phase + i * Math.PI)));
      return;
    }
    if (mode === "stumble") {
      // Cramp: up out of the stroke, bobbing, arms thrown up.
      const t = phase / (Math.PI * 2);
      const fall = Math.sin(Math.PI * t);
      root.rotation.z = -Math.PI / 2 + (Math.PI / 2) * fall;
      root.position.set(-0.95 * (1 - fall), 0.05 - 1.15 * fall + 0.08 * Math.sin(t * Math.PI * 10), 0);
      arms.forEach((arm, i) => {
        arm.upper.rotation.set((i ? 1 : -1) * 0.4, 0, 2.6 + 0.5 * Math.sin(t * Math.PI * 12 + i * 2));
        arm.lower.rotation.z = 0.3;
      });
      head.rotation.z = 0.3 * fall;
      return;
    }
    // In the water, not on it: head first along +x, face down, sunk to the
    // waterline so only the back of the head, the shoulders, the arms coming
    // over and the kicking heels break the surface — and tipped a little,
    // head up and hips low, as a real stroke rides.
    root.rotation.z = -Math.PI / 2 + SWIM_TILT;
    root.position.set(-0.95, SWIM_DEPTH, 0);
    const butterfly = mode === "boost";
    arms.forEach((arm, i) => {
      // One full turn per stroke: under the water, past the hip, out and over.
      const offset = butterfly ? 0 : i * Math.PI;
      arm.upper.rotation.set(0, 0, Math.PI - phase - offset);
      arm.lower.rotation.z = 0.25;
    });
    const kick = butterfly ? 0.45 : 0.28;
    legs.forEach((leg, i) => {
      leg.upper.rotation.z = kick * Math.sin(phase * (butterfly ? 1 : 3) + (butterfly ? 0 : i * Math.PI));
      leg.lower.rotation.z = -0.25;
    });
    if (butterfly) {
      // The dolphin wave: the whole body rises and dips with each stroke.
      root.position.y = SWIM_DEPTH + 0.1 * Math.sin(phase);
      root.rotation.z = -Math.PI / 2 + SWIM_TILT + 0.12 * Math.sin(phase + 1);
    } else {
      // Breathing to the side on every other stroke.
      head.rotation.y = 0.9 * Math.max(0, Math.sin(phase));
      chest.rotation.y = 0.25 * Math.sin(phase);
    }
    hips.position.y = 0.95;
  };

  return {
    root: outer,
    pose,
    center: [0, 0.2, 0],
    halfHeight: 1.12,
    aspect: 1.6,
    nose: [1.05, 0.1, 0],
    tail: [-1.0, 0.1, 0],
    head: [0.85, 0.35, 0],
    tinted: human.tinted,
  };
}

/* ───────────────────────────── the horse ───────────────────────────── */

/** Coats, dealt one per lane; the lane's colour is the jockey's silks. */
export const HORSE_COATS = ["bay", "chestnut", "black", "grey", "palomino", "white"] as const;
const COAT_COLORS: Record<
  (typeof HORSE_COATS)[number],
  { coat: string; mane: string; muzzle: string; blaze: boolean; socks: number }
> = {
  bay: { coat: "#8a4a22", mane: "#1f140d", muzzle: "#3b2416", blaze: true, socks: 2 },
  chestnut: { coat: "#c0652d", mane: "#8a3d16", muzzle: "#6e3514", blaze: true, socks: 4 },
  black: { coat: "#2a2522", mane: "#0d0b0a", muzzle: "#141110", blaze: false, socks: 1 },
  grey: { coat: "#b4b4ae", mane: "#eeeeea", muzzle: "#6f6f6a", blaze: false, socks: 0 },
  palomino: { coat: "#dcb262", mane: "#f7efdc", muzzle: "#8f6b33", blaze: true, socks: 0 },
  white: { coat: "#f2efe8", mane: "#d8d2c6", muzzle: "#c9b8ad", blaze: false, socks: 0 },
};

/**
 * A cartoon racehorse: round chest and rump, a thick neck with a tufted
 * mane, a head with a muzzle and big googly eyes, socks and a blaze on some
 * coats — and a jockey in the lane's silks, big enough to read.
 */
function horseRig(THREE: typeof Three, look: string): Rig {
  const colors = COAT_COLORS[look as (typeof HORSE_COATS)[number]] ?? COAT_COLORS.bay;
  const mat = (color: string, roughness = 0.55) => new THREE.MeshStandardMaterial({ color, roughness });
  const coat = mat(colors.coat);
  const mane = mat(colors.mane, 0.85);
  const muzzle = mat(colors.muzzle, 0.6);
  const hoof = mat("#1c1917", 0.45);
  const white = mat("#f8f7f2", 0.6);
  const leather = mat("#6b3f1d", 0.5);
  const eyeWhite = mat("#ffffff", 0.2);
  const pupil = mat("#0f172a", 0.2);

  // The jockey first: the saddle cloth is dyed in the same silks.
  const jockey = humanRig(THREE);
  const silks = jockey.tinted[0];

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.22;
  root.add(body);
  const barrel = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.75, 8, 18), coat);
  barrel.rotation.z = Math.PI / 2;
  barrel.scale.set(1, 1, 0.82);
  body.add(barrel);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 16), coat);
  chest.position.set(0.45, 0.04, 0);
  chest.scale.set(1, 1.05, 0.82);
  body.add(chest);
  const rump = new THREE.Mesh(new THREE.SphereGeometry(0.41, 20, 16), coat);
  rump.position.set(-0.46, 0.06, 0);
  rump.scale.set(1, 1, 0.88);
  body.add(rump);
  // A saddle cloth draped over the back: an open arc of a cylinder lying
  // along the barrel, centred on the top (θ = π/2 once turned onto its side).
  const cloth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.39, 0.39, 0.62, 20, 1, true, Math.PI / 2 - Math.PI * 0.4, Math.PI * 0.8),
    silks,
  );
  cloth.material.side = THREE.DoubleSide;
  cloth.rotation.z = Math.PI / 2;
  cloth.scale.set(1, 1, 0.86);
  cloth.position.set(-0.02, 0.02, 0);
  body.add(cloth);
  const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), leather);
  saddle.scale.set(1.1, 0.35, 1.05);
  saddle.position.set(0, 0.36, 0);
  body.add(saddle);

  const neck = new THREE.Group();
  neck.position.set(0.62, 0.22, 0);
  body.add(neck);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.8, 16), coat);
  neckMesh.position.set(0.2, 0.32, 0);
  neckMesh.rotation.z = -0.6;
  neckMesh.scale.set(1, 1, 0.8);
  neck.add(neckMesh);
  for (let i = 0; i < 7; i++) {
    // A tufted mane down the crest of the neck.
    const u = i / 6;
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mane);
    tuft.scale.set(1.5, 0.9, 0.55);
    tuft.position.set(-0.08 + u * 0.4, 0.12 + u * 0.56, 0);
    tuft.rotation.z = -0.9 + 0.3 * Math.sin(i * 2);
    neck.add(tuft);
  }

  const head = new THREE.Group();
  head.position.set(0.43, 0.68, 0);
  neck.add(head);
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), coat);
  cranium.scale.set(1.15, 1, 0.88);
  head.add(cranium);
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.2, 8, 14), coat);
  snout.rotation.z = -2.0;
  snout.position.set(0.18, -0.1, 0);
  snout.scale.set(1, 1, 0.9);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), muzzle);
  nose.scale.set(1, 0.9, 0.92);
  nose.position.set(0.31, -0.2, 0);
  head.add(nose);
  for (const z of [-0.05, 0.05]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), hoof);
    nostril.position.set(0.4, -0.19, z);
    head.add(nostril);
  }
  if (colors.blaze) {
    const blaze = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.07), white);
    blaze.position.set(0.19, -0.04, 0);
    blaze.rotation.z = -1.05;
    head.add(blaze);
  }
  for (const z of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.17, 10), coat);
    ear.position.set(-0.05, 0.18, z * 0.08);
    ear.rotation.set(z * 0.2, 0, 0.25);
    head.add(ear);
    // Big googly eyes, one looking a little off.
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 12), eyeWhite);
    eye.position.set(0.06, 0.05, z * 0.13);
    head.add(eye);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), pupil);
    dot.position.set(0.1, 0.06 + (z > 0 ? 0.012 : -0.008), z * 0.165);
    head.add(dot);
  }
  const forelock = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mane);
  forelock.scale.set(1.2, 0.8, 0.8);
  forelock.position.set(0.02, 0.17, 0);
  head.add(forelock);

  const tail = new THREE.Group();
  tail.position.set(-0.84, 0.16, 0);
  body.add(tail);
  for (let i = 0; i < 3; i++) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mane);
    lock.scale.set(0.9, 3.2, 0.9);
    lock.position.set(-0.1 - i * 0.03, -0.22 - i * 0.05, (i - 1) * 0.05);
    lock.rotation.z = 0.45 + i * 0.1;
    tail.add(lock);
  }

  const leg = (x: number, z: number, sock: boolean) => {
    const upper = new THREE.Group();
    upper.position.set(x, -0.18, z);
    body.add(upper);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.52, 12), coat);
    thigh.position.y = -0.24;
    upper.add(thigh);
    const lower = new THREE.Group();
    lower.position.y = -0.5;
    upper.add(lower);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.4, 10), sock ? white : coat);
    cannon.position.y = -0.2;
    lower.add(cannon);
    const fetlock = new THREE.Mesh(new THREE.SphereGeometry(0.066, 10, 8), sock ? white : coat);
    fetlock.position.y = -0.42;
    lower.add(fetlock);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.078, 0.09, 12), hoof);
    foot.position.y = -0.5;
    lower.add(foot);
    return { upper, lower };
  };
  // Front right, front left, hind right, hind left.
  const legs = [
    leg(0.45, 0.16, colors.socks >= 3),
    leg(0.45, -0.16, colors.socks >= 4),
    leg(-0.46, 0.16, colors.socks >= 1),
    leg(-0.46, -0.16, colors.socks >= 2),
  ];

  // The jockey: nearly full size, so the rider reads at race scale.
  jockey.root.scale.setScalar(0.88);
  body.add(jockey.root);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), silks);
  helmet.position.y = 0.02;
  jockey.parts.head.add(helmet);
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.2), silks);
  peak.position.set(0.17, 0.03, 0);
  jockey.parts.head.add(peak);
  // White breeches (the rig's shorts, recoloured) and tall black boots, so
  // the legs stand out against the horse.
  const breeches = (jockey.parts.hips.children[0] as Three.Mesh).material as Three.MeshStandardMaterial;
  breeches.color.set("#f8fafc");
  const bootLeather = mat("#111827", 0.35);
  const stirrupIron = mat("#cbd5e1", 0.3);
  jockey.parts.legs.forEach(({ lower }) => {
    const boot = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 6, 12), bootLeather);
    boot.position.y = -0.26;
    lower.add(boot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.11), bootLeather);
    toe.position.set(0.06, -0.47, 0);
    lower.add(toe);
    const iron = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 14), stirrupIron);
    iron.position.set(0.04, -0.5, 0);
    lower.add(iron);
  });

  const seatJockey = (phase: number, whip: boolean, bounce: number) => {
    const { hips, chest: torso, head: jHead, legs: jLegs, arms } = jockey.parts;
    jockey.pose({ phase: 0, mode: "stand" });
    jockey.root.position.set(-0.08, 0.05 + bounce, 0);
    hips.position.y = 0.66;
    // Up in the stirrups, flat over the neck, eyes on the finish. The legs
    // straddle the horse — thighs forward and out past its sides, shins back
    // down the flank — or they would vanish inside the barrel.
    torso.rotation.z = -1.05;
    jHead.rotation.z = 0.85;
    jLegs.forEach((l, i) => {
      l.upper.rotation.set((i ? 1 : -1) * 1.0, 0, 0.95);
      l.lower.rotation.z = -1.75;
    });
    arms.forEach((arm, i) => {
      arm.upper.rotation.set((i ? 1 : -1) * 0.15, 0, 1.45);
      arm.lower.rotation.z = 0.35;
    });
    if (whip) arms[0].upper.rotation.set(-0.4, 0, 2.6 + 0.9 * Math.sin(phase * 2));
  };

  const pose = ({ phase, mode }: Pose) => {
    root.rotation.set(0, 0, 0);
    root.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    body.position.y = 1.22;
    neck.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    tail.rotation.set(0, 0, 0);
    if (mode === "stand") {
      legs.forEach((l) => {
        l.upper.rotation.z = 0;
        l.lower.rotation.z = 0;
      });
      neck.rotation.z = -0.2;
      seatJockey(0, false, 0);
      jockey.parts.chest.rotation.z = -0.35;
      jockey.parts.head.rotation.z = 0.2;
      return;
    }
    if (mode === "stumble") {
      // Rearing: up on the hind legs, forelegs pawing, the jockey clinging on.
      const t = phase / (Math.PI * 2);
      const rear = Math.sin(Math.PI * t);
      const angle = 0.75 * rear;
      root.rotation.z = angle;
      // Pivot on the hind hooves rather than the middle, which would sink them.
      root.position.set(0.46 * (1 - Math.cos(angle)) - 0.2 * rear, 0.46 * Math.sin(angle), 0);
      legs.forEach((l, i) => {
        if (i < 2) {
          l.upper.rotation.z = 0.8 * rear + 0.5 * Math.sin(t * Math.PI * 8 + i);
          l.lower.rotation.z = -1.4 * rear;
        } else {
          l.upper.rotation.z = -0.5 * rear;
          l.lower.rotation.z = 0.3 * rear;
        }
      });
      neck.rotation.z = 0.35 * rear;
      head.rotation.z = 0.3 * rear;
      tail.rotation.z = -0.6 * rear;
      seatJockey(phase, false, 0);
      jockey.parts.chest.rotation.z = -0.3;
      jockey.parts.arms.forEach((arm, i) => arm.upper.rotation.set((i ? 1 : -1) * 0.5, 0, 2.8));
      return;
    }
    const boost = mode === "boost";
    const reach = boost ? 0.85 : 0.65;
    // A gallop: hind right, hind left, then front right, front left.
    const offsets = [1.9, 1.5, 0.4, 0];
    legs.forEach((l, i) => {
      const p = phase + offsets[i];
      const front = i < 2;
      l.upper.rotation.z = reach * Math.sin(p);
      const lift = Math.max(0, Math.sin(p + 1.2));
      l.lower.rotation.z = front ? -1.4 * lift : 1.15 * lift;
    });
    body.position.y = 1.22 + 0.08 * Math.sin(phase * 2);
    body.rotation.z = 0.06 * Math.sin(phase);
    neck.rotation.z = 0.12 * Math.sin(phase + 0.6) - 0.15;
    head.rotation.z = 0.1 * Math.sin(phase + 1.4);
    tail.rotation.z = 0.35 * Math.sin(phase * 2) - 0.2;
    seatJockey(phase, boost, 0.05 * Math.sin(phase * 2 + 1));
  };

  return {
    root,
    pose,
    center: [0.15, 1.25, 0],
    halfHeight: 1.3,
    aspect: 1.2,
    nose: [1.35, 1.9, 0],
    tail: [-1.0, 1.3, 0],
    head: [0.35, 2.5, 0],
    tinted: [silks],
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

  const makeRig = (look: string): Rig => {
    switch (kind) {
      case "duck":
        return duckRig(THREE, look as DuckLook);
      case "swimmer":
        return swimmerRig(THREE);
      case "horse":
        return horseRig(THREE, look);
      case "human":
        return humanRig(THREE);
    }
  };
  // In the water: nothing under the waterline is drawn, or needs room.
  const afloat = kind === "duck" || kind === "swimmer";
  // The first rig sets the camera; every look of a kind shares it.
  const first = makeRig(looks[0]?.look ?? "classic");

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
  // A duck never throws or slips: those frames are left empty.
  // Only a human on foot throws, or slips on a peel: other sheets leave those frames empty.
  const skipped = (pose: Pose) => kind !== "human" && (pose.mode === "throw" || pose.mode === "slip");

  // Orthographic, from a little in front and above: the model reads as solid
  // 3D, while its size stays the same whatever the lane.
  const center = new THREE.Vector3(...first.center);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.copy(center).add(new THREE.Vector3(0.9, 1.1, 4).normalize().multiplyScalar(10));
  camera.lookAt(center);
  camera.updateMatrixWorld();

  // The frame is made big enough for every pose of every look, measured in
  // the camera's view. A fixed box sized for someone standing cut off the
  // head of a runner pitching forward and the feet of one flat on their back.
  const bounds = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
  const corner = new THREE.Vector3();
  const measure = (rig: Rig) => {
    for (const pose of poses) {
      if (skipped(pose)) continue;
      rig.pose(pose);
      rig.root.updateMatrixWorld(true);
      rig.root.traverse((node) => {
        const mesh = node as Three.Mesh;
        if (!mesh.isMesh) return;
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const { min, max } = mesh.geometry.boundingBox!;
        for (let c = 0; c < 8; c++) {
          corner.set(c & 1 ? max.x : min.x, c & 2 ? max.y : min.y, c & 4 ? max.z : min.z);
          corner.applyMatrix4(mesh.matrixWorld);
          // Below the waterline a duck is not drawn, so it needs no room there.
          // A duck is cut off at the waterline; a swimmer is seen through it.
          if (kind === "duck") corner.y = Math.max(0, corner.y);
          corner.applyMatrix4(camera.matrixWorldInverse);
          bounds.left = Math.min(bounds.left, corner.x);
          bounds.right = Math.max(bounds.right, corner.x);
          bounds.bottom = Math.min(bounds.bottom, corner.y);
          bounds.top = Math.max(bounds.top, corner.y);
        }
      });
    }
  };
  const rigs = new Map<string, Rig>();
  for (const { look } of looks) {
    if (rigs.has(look)) continue;
    const rig = rigs.size === 0 ? first : makeRig(look);
    rigs.set(look, rig);
    measure(rig);
  }
  const margin = 0.04;
  Object.assign(camera, {
    left: bounds.left - margin,
    right: bounds.right + margin,
    bottom: bounds.bottom - margin,
    top: bounds.top + margin,
  });
  camera.updateProjectionMatrix();

  // `height` is how tall the model is drawn standing, as before: the scale
  // is fixed by that, and the frame is however big the poses need.
  const unit = height / (2 * first.halfHeight);
  const width = Math.ceil((camera.right - camera.left) * unit);
  const frameHeight = Math.ceil((camera.top - camera.bottom) * unit);
  const px = { w: Math.ceil(width * ratio), h: Math.ceil(frameHeight * ratio) };

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

  const toScreen = (point: [number, number, number]) => {
    const v = new THREE.Vector3(...point).project(camera);
    return { x: ((v.x + 1) / 2) * width, y: ((1 - v.y) / 2) * frameHeight };
  };
  const foot = toScreen([0, 0, 0]);
  const nose = toScreen(first.nose);
  const tail = toScreen(first.tail);
  const head = toScreen(first.head);

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

  for (const [look, colors] of byLook) {
    const rig = rigs.get(look)!;
    scene.add(rig.root);
    // In the water, each frame is drawn in two passes split at the waterline.
    // Above it, as is. Below it, a duck is simply not drawn; a swimmer is
    // drawn faint and pool-blue, as if seen through the water — without
    // that the body reads as lying on top of the pool, not in it.
    const materials = new Set<Three.Material>();
    rig.root.traverse((node) => {
      const mesh = node as Three.Mesh;
      if (mesh.isMesh) materials.add(mesh.material as Three.Material);
    });
    const clip = (planes: Three.Plane[]) => materials.forEach((material) => (material.clippingPlanes = planes));
    const above = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.01);
    const below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.01);
    const seenThroughWater = kind === "swimmer";
    const underwater = document.createElement("canvas");
    underwater.width = px.w;
    underwater.height = px.h;
    const underwaterContext = underwater.getContext("2d")!;
    for (const color of colors) {
      for (const material of rig.tinted) material.color.set(color);
      const sheet = document.createElement("canvas");
      sheet.width = px.w * poses.length;
      sheet.height = px.h;
      const context = sheet.getContext("2d")!;
      poses.forEach((pose, i) => {
        if (skipped(pose)) return;
        rig.pose(pose);
        if (seenThroughWater) {
          clip([below]);
          renderer.render(scene, camera);
          underwaterContext.globalCompositeOperation = "copy";
          underwaterContext.drawImage(renderer.domElement, 0, 0);
          underwaterContext.globalCompositeOperation = "source-atop";
          underwaterContext.fillStyle = "rgba(20, 110, 170, 0.62)";
          underwaterContext.fillRect(0, 0, px.w, px.h);
          context.globalAlpha = 0.55;
          context.drawImage(underwater, i * px.w, 0);
          context.globalAlpha = 1;
        }
        if (afloat) clip([above]);
        renderer.render(scene, camera);
        context.drawImage(renderer.domElement, i * px.w, 0);
      });
      sheets.set(lookKey({ look, color }), sheet);
      // Let a frame through between sheets so the countdown keeps ticking.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    scene.remove(rig.root);
    dispose(rig.root);
  }

  renderer.dispose();
  renderer.forceContextLoss();

  return {
    width,
    height: frameHeight,
    footX: foot.x,
    footY: foot.y,
    noseX: nose.x,
    tailX: tail.x,
    headX: head.x,
    headY: head.y,
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

/* ───────────────────────────── scenery ───────────────────────────── */

/** Things along the back of a course that are drawn in 3D rather than as pixel art. */
export type PropKind = "umbrella" | "rail";

function propModel(THREE: typeof Three, kind: PropKind): Three.Group {
  const group = new THREE.Group();
  const mat = (color: string, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness });
  if (kind === "umbrella") {
    // A striped parasol over a sun lounger.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), mat("#f8fafc"));
    pole.position.y = 0.9;
    group.add(pole);
    const stripes = [mat("#ef4444"), mat("#ffffff")];
    for (let i = 0; i < 8; i++) {
      const wedge = new THREE.Mesh(
        new THREE.CylinderGeometry(0, 0.95, 0.4, 3, 1, true, (i * Math.PI) / 4, Math.PI / 4),
        stripes[i % 2],
      );
      wedge.material.side = THREE.DoubleSide;
      wedge.position.y = 1.75;
      group.add(wedge);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.45), mat("#38bdf8"));
    seat.position.set(0.55, 0.32, 0.3);
    group.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.45), mat("#38bdf8"));
    back.position.set(1.18, 0.5, 0.3);
    back.rotation.z = 0.7;
    group.add(back);
    for (const x of [0.1, 1.0]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.3, 0.4), mat("#e5e7eb"));
      leg.position.set(x, 0.15, 0.3);
      group.add(leg);
    }
  } else {
    // A length of white running rail, with a hedge behind it.
    const white = mat("#ffffff", 0.35);
    for (const y of [0.55, 0.95]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 0.08), white);
      bar.position.y = y;
      group.add(bar);
    }
    for (const x of [-1.4, -0.45, 0.45, 1.4]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), white);
      post.position.set(x, 0.5, 0);
      group.add(post);
    }
    const leaves = mat("#3f7f30", 0.9);
    for (let i = 0; i < 6; i++) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), leaves);
      bush.position.set(-1.3 + i * 0.52, 0.45 + (i % 2) * 0.12, -0.45);
      group.add(bush);
    }
    const flowers = [mat("#f472b6"), mat("#facc15"), mat("#ffffff")];
    for (let i = 0; i < 9; i++) {
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), flowers[i % 3]);
      bloom.position.set(-1.35 + i * 0.33, 0.6 + ((i * 7) % 3) * 0.12, -0.12);
      group.add(bloom);
    }
  }
  group.traverse((node) => {
    if ((node as Three.Mesh).isMesh) node.castShadow = false;
  });
  return group;
}

/**
 * One scenery model rendered to an image `height` CSS px tall, lit and seen
 * from the same angle as the racers. Null where WebGL is unavailable.
 */
export async function buildPropImage(
  kind: PropKind,
  height: number,
  ratio: number,
): Promise<{ image: HTMLCanvasElement; width: number; height: number } | null> {
  const THREE = await import("three");
  const model = propModel(THREE, kind);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  scene.add(model);
  model.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  camera.position.copy(center).add(new THREE.Vector3(0.9, 1.1, 4).normalize().multiplyScalar(10));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  const corner = new THREE.Vector3();
  for (let c = 0; c < 8; c++) {
    corner.set(c & 1 ? box.max.x : box.min.x, c & 2 ? box.max.y : box.min.y, c & 4 ? box.max.z : box.min.z);
    corner.applyMatrix4(camera.matrixWorldInverse);
    left = Math.min(left, corner.x);
    right = Math.max(right, corner.x);
    bottom = Math.min(bottom, corner.y);
    top = Math.max(top, corner.y);
  }
  Object.assign(camera, { left, right, bottom, top });
  camera.updateProjectionMatrix();
  const width = Math.ceil(((right - left) / (top - bottom)) * height);

  let renderer: Three.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(Math.ceil(width * ratio), Math.ceil(height * ratio), false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.render(scene, camera);
  const image = document.createElement("canvas");
  image.width = Math.ceil(width * ratio);
  image.height = Math.ceil(height * ratio);
  image.getContext("2d")!.drawImage(renderer.domElement, 0, 0);
  renderer.dispose();
  renderer.forceContextLoss();
  model.traverse((node) => {
    const mesh = node as Three.Mesh;
    if (mesh.isMesh) {
      mesh.geometry.dispose();
      (mesh.material as Three.Material).dispose();
    }
  });
  return { image, width, height };
}
