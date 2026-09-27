import {
  BUSH,
  CACTUS,
  DINO_RUN_A,
  DINO_RUN_B,
  DINO_STAND,
  DUCK,
  PERSON_RUN_A,
  PERSON_RUN_B,
  PERSON_STAND,
  REED,
  type Sprite,
} from "./pixel-art";

export type RacerKind = "dino" | "duck" | "human";

/** How the ground is marked, in the tile that scrolls under the runners. */
type Marks = "pebbles" | "ripples" | "lanes";

export type Racer = {
  kind: RacerKind;
  label: string;
  emoji: string;
  /** Two running frames, swapped by distance covered, and one standing still. */
  run: [Sprite, Sprite];
  stand: Sprite;
  /** Legs on the ground: a shadow and a hop in the stride. A duck floats and bobs instead. */
  grounded: boolean;
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
  };
};

export const RACERS: Record<RacerKind, Racer> = {
  dino: {
    kind: "dino",
    label: "Khủng long",
    emoji: "🦖",
    run: [DINO_RUN_A, DINO_RUN_B],
    stand: DINO_STAND,
    grounded: true,
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
    emoji: "🦆",
    run: [DUCK, DUCK],
    stand: DUCK,
    grounded: false,
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
    emoji: "🏃",
    run: [PERSON_RUN_A, PERSON_RUN_B],
    stand: PERSON_STAND,
    grounded: true,
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
};

export const RACER_KINDS = [RACERS.dino, RACERS.duck, RACERS.human];
