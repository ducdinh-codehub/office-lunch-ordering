import {
  BUSH,
  CACTUS,
  DINO_RUN_A,
  DINO_RUN_B,
  DINO_STAND,
  DUCK,
  HORSE_RUN_A,
  HORSE_RUN_B,
  HORSE_STAND,
  PERSON_RUN_A,
  PERSON_RUN_B,
  PERSON_STAND,
  RAIL,
  REED,
  SWIMMER_A,
  SWIMMER_B,
  UMBRELLA,
  type Sprite,
} from "./pixel-art";
import { DUCK_LOOKS, HORSE_COATS, type ModelKind, type PropKind } from "./models-3d";

export type RacerKind = "dino" | "duck" | "human" | "swim" | "horse";

/** How the ground is marked, in the tile that scrolls under the runners. */
type Marks = "pebbles" | "ripples" | "lanes" | "ropes";

/** How a surprise is shown over a racer's head and called by the commentator. */
export type Flavor = { emoji: string; text: string };

const BURST: Flavor = { emoji: "🔥", text: "tăng tốc!" };
const ROCKET: Flavor = { emoji: "🚀", text: "bứt phá từ cuối đoàn!" };

export type Racer = {
  kind: RacerKind;
  label: string;
  /** What one of them is called in a count: "6 vịt", "6 kình ngư". */
  unit: string;
  emoji: string;
  /** Two running frames, swapped by distance covered, and one standing still. */
  run: [Sprite, Sprite];
  stand: Sprite;
  /** Legs on the ground: a shadow and a hop in the stride. A duck floats and bobs instead. */
  grounded: boolean;
  /**
   * Raced as a 3D model (`models-3d.ts`), with its height in pixel-art cells so
   * it sizes with the field; the sprites above are then only the fallback for a
   * browser without WebGL. Absent for the dino, which is pixel art by design.
   */
  model?: {
    kind: ModelKind;
    cells: number;
    /** Nose to tail, as a share of the height. */
    length: number;
    /** Costumes or coats, dealt one per lane from a shuffle each race. */
    looks?: readonly string[];
  };
  /** Throws pies and drops banana peels (`planRace`'s weapons). */
  weapons: boolean;
  /**
   * How this racer's surprises look and are called — a burst, last place's
   * big one, a stumble. One of each list is picked per event, the same way
   * for the icon and the commentary, so a shark is always a shark.
   */
  bursts: Flavor[];
  rockets: Flavor[];
  stumbles: Flavor[];
  /** Something drawn with last place's big burst: a shark behind, a carrot ahead. */
  chaser?: "shark" | "carrot";
  scene: {
    skyTop: string;
    skyBottom: string;
    /** Distant shapes on the horizon, scrolled slower than the ground. */
    far: "mesas" | "hills";
    farColor: string;
    farShade: string;
    ground: string;
    /** The strip where the ground meets the horizon: a sand edge, a river bank, a verge of grass. */
    edge: string;
    edgeHeight: number;
    marks: Marks;
    mark: string;
    /** Along the back of the course, every few hundred px. */
    prop: Sprite;
    propColor: string;
    /** Drawn as a 3D model instead of `prop`, where WebGL allows. */
    prop3d?: PropKind;
  };
};

export const RACERS: Record<RacerKind, Racer> = {
  dino: {
    kind: "dino",
    label: "Khủng long",
    unit: "khủng long",
    emoji: "🦖",
    run: [DINO_RUN_A, DINO_RUN_B],
    stand: DINO_STAND,
    grounded: true,
    weapons: false,
    bursts: [BURST],
    rockets: [ROCKET],
    stumbles: [{ emoji: "💫", text: "vấp ngã!" }],
    scene: {
      skyTop: "#7cc8ee",
      skyBottom: "#d5f0fb",
      far: "mesas",
      farColor: "#dca36b",
      farShade: "#c98b52",
      ground: "#f2d9a2",
      edge: "#e6c485",
      edgeHeight: 3,
      marks: "pebbles",
      mark: "#c9a468",
      prop: CACTUS,
      propColor: "#4f8a3c",
    },
  },
  duck: {
    kind: "duck",
    label: "Vịt",
    unit: "vịt",
    emoji: "🦆",
    run: [DUCK, DUCK],
    stand: DUCK,
    grounded: false,
    model: { kind: "duck", cells: 23, length: 1.05, looks: DUCK_LOOKS },
    weapons: false,
    bursts: [BURST],
    rockets: [ROCKET],
    stumbles: [{ emoji: "🌀", text: "bị cuốn vào xoáy nước!" }],
    scene: {
      skyTop: "#8ccfee",
      skyBottom: "#e0f4fb",
      far: "hills",
      farColor: "#7fb069",
      farShade: "#6a9a56",
      ground: "#4f9fc6",
      edge: "#5f9e3f",
      edgeHeight: 8,
      marks: "ripples",
      mark: "rgba(255, 255, 255, 0.45)",
      prop: REED,
      propColor: "#3f7d2e",
    },
  },
  human: {
    kind: "human",
    label: "Người",
    unit: "người",
    emoji: "🏃",
    run: [PERSON_RUN_A, PERSON_RUN_B],
    stand: PERSON_STAND,
    grounded: true,
    model: { kind: "human", cells: 26, length: 0.45 },
    weapons: true,
    bursts: [BURST],
    rockets: [ROCKET],
    stumbles: [{ emoji: "💫", text: "vấp ngã!" }],
    scene: {
      skyTop: "#7cc0ee",
      skyBottom: "#dcf1fb",
      far: "hills",
      farColor: "#8cc084",
      farShade: "#76a96e",
      ground: "#c8553f",
      edge: "#5f9e3f",
      edgeHeight: 6,
      marks: "lanes",
      mark: "rgba(255, 255, 255, 0.55)",
      prop: BUSH,
      propColor: "#3f7d2e",
    },
  },
  swim: {
    kind: "swim",
    label: "Bơi lội",
    unit: "kình ngư",
    emoji: "🏊",
    run: [SWIMMER_A, SWIMMER_B],
    stand: SWIMMER_A,
    grounded: false,
    model: { kind: "swimmer", cells: 34, length: 0.9 },
    weapons: false,
    bursts: [{ emoji: "🦋", text: "chuyển sang bơi bướm!" }],
    rockets: [{ emoji: "🦈", text: "bị cá mập đuổi sau lưng!" }],
    stumbles: [
      { emoji: "🥴", text: "bị chuột rút!" },
      { emoji: "🪼", text: "bị sứa chích!" },
      { emoji: "🦆", text: "vướng phải vịt cao su!" },
    ],
    chaser: "shark",
    scene: {
      skyTop: "#6ec1ef",
      skyBottom: "#d9f1fb",
      far: "hills",
      farColor: "#8cc084",
      farShade: "#76a96e",
      ground: "#2fa3d6",
      edge: "#e5e7eb",
      edgeHeight: 8,
      marks: "ropes",
      mark: "rgba(255, 255, 255, 0.4)",
      prop: UMBRELLA,
      propColor: "#ef4444",
      prop3d: "umbrella",
    },
  },
  horse: {
    kind: "horse",
    label: "Đua ngựa",
    unit: "ngựa",
    emoji: "🏇",
    run: [HORSE_RUN_A, HORSE_RUN_B],
    stand: HORSE_STAND,
    grounded: true,
    model: { kind: "horse", cells: 32, length: 0.9, looks: HORSE_COATS },
    weapons: false,
    bursts: [{ emoji: "🏇", text: "được nài ra roi!" }],
    rockets: [{ emoji: "🥕", text: "thấy cà rốt, phi như bay!" }],
    stumbles: [
      { emoji: "💢", text: "lồng lên!" },
      { emoji: "🐝", text: "bị ong đốt, lồng lên!" },
      { emoji: "📸", text: "giật mình vì đèn flash!" },
    ],
    chaser: "carrot",
    scene: {
      skyTop: "#8ccfee",
      skyBottom: "#e6f6fb",
      far: "hills",
      farColor: "#86b86e",
      farShade: "#6f9f5a",
      ground: "#4f9a3c",
      edge: "#f8fafc",
      edgeHeight: 4,
      marks: "pebbles",
      mark: "#3f7f30",
      prop: RAIL,
      propColor: "#f8fafc",
      prop3d: "rail",
    },
  },
};

export const RACER_KINDS = [RACERS.dino, RACERS.duck, RACERS.human, RACERS.swim, RACERS.horse];

/** Which of a racer's flavours a surprise gets: fixed by the event, so icon and commentary agree. */
export function flavorOf(list: Flavor[], startMs: number, runner: number): Flavor {
  return list[(Math.round(startMs / 250) + runner) % list.length];
}
