"use client";

import { useEffect, useRef } from "react";

import { eventAt, pieLandsMs, progressAt, STEP_MS, type RaceEvent, type RacePlan } from "@/lib/dino-race";
import {
  buildModelFrames,
  DUCK_LOOKS,
  lookKey,
  moveFrames,
  sheetFrame,
  SHEET_FRAMES,
  type Look,
  type ModelFrames,
  type PoseMode,
} from "./models-3d";
import { CLOUD, CROWN, spriteCache } from "./pixel-art";
import { RACERS, type RacerKind } from "./racers";
import { pickVideoType } from "./recording";

/** 3, 2, 1 — then the race clock starts. */
export const COUNTDOWN_MS = 3000;
/** How long a recording lingers on the finish before it ends. */
const HOLD_MS = 2000;
/** After the podium is home, the race runs on this long before the results. */
const AFTER_PODIUM_MS = 1000;
/** …but never longer than this past the winner, however far back third place is. */
const MAX_AFTER_WINNER_MS = 12_000;

/**
 * How fast the field moves across the ground, px/s. The track is as long as
 * the time needs at this pace, so a 60-second race covers many screens and the
 * camera follows the pack instead of shrinking everyone onto one.
 */
const SPEED = 150;

/** A photo finish plays this stretch of race time, around the line, slowed down. */
const SLOW_BEFORE_MS = 1200;
const SLOW_AFTER_MS = 500;
const SLOW_RATE = 0.3;

/**
 * What every scene shares; the rest comes with the racer (`racers.ts`). The
 * same in either theme: it is a picture, not chrome.
 */
const SCENE = {
  cloud: "#ffffff",
  shadow: "rgba(60, 40, 20, 0.25)",
  check: "#111827",
  tag: "#ffffff",
  tagText: "#1f2937",
  gold: "#f59e0b",
  banner: "rgba(17, 24, 39, 0.82)",
};

/** One colour per lane, so a runner can be followed through a crowd. */
export const COLORS = [
  "#16a34a", "#2563eb", "#dc2626", "#9333ea", "#ea580c",
  "#0891b2", "#db2777", "#65a30d", "#4f46e5", "#a16207",
];

const MEDALS = ["🥇", "🥈", "🥉"];
const EMOJI_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

const CHECK = 5;
/** How far right each row sits per px further back — the slant of the grid and its lines. */
const LEAN = 0.45;

/** A bigger field gets a taller track; lanes overlap either way. */
function trackHeight(count: number): number {
  return Math.min(460, Math.max(260, 170 + count * 10));
}

function ellipsize(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function offscreen(width: number, height: number, ratio: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * ratio));
  canvas.height = Math.max(1, Math.ceil(height * ratio));
  const context = canvas.getContext("2d")!;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.imageSmoothingEnabled = false;
  return { canvas, context };
}

/** Draws `image` repeated across the width, scrolled by `offset` px. */
function tile(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  tileWidth: number,
  tileHeight: number,
  offset: number,
  y: number,
  width: number,
) {
  const start = -(((offset % tileWidth) + tileWidth) % tileWidth);
  for (let x = start; x < width; x += tileWidth) context.drawImage(image, x, y, tileWidth, tileHeight);
}

/** "00:00:08" — whole seconds left, rounded up so 0 only shows at the line. */
function clockText(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

/**
 * Race time for wall-clock time since the start: the same, except through a
 * photo finish, which is played slowed down. Both are negative in the countdown.
 */
function raceClock(plan: RacePlan) {
  const from = plan.photoFinish ? plan.durationMs - SLOW_BEFORE_MS : Infinity;
  const to = plan.durationMs + SLOW_AFTER_MS;
  const slowWall = (to - from) / SLOW_RATE;
  return {
    at(wall: number): number {
      if (wall <= from) return wall;
      if (wall <= from + slowWall) return from + (wall - from) * SLOW_RATE;
      return to + (wall - from - slowWall);
    },
    slow: (race: number) => race > from && race < to,
  };
}

type Line = { atMs: number; text: string; priority: number };

/** What the commentator says, and when: lead changes, surprises and the finish. */
function commentary(plan: RacePlan, kind: RacerKind): Line[] {
  const name = (runner: number) => plan.runners[runner].name;
  const stumble = RACERS[kind].stumble;
  const lines: Line[] = plan.leadChanges.map((change, i) => ({
    atMs: change.atMs,
    text: i === 0 ? `⚡ ${name(change.runner)} xuất phát nhanh nhất!` : `👑 ${name(change.runner)} vượt lên dẫn đầu!`,
    priority: 2,
  }));
  for (const event of plan.events) {
    // Throws and their hits are called from the attacks below.
    if (event.kind === "throw" || event.kind === "splat" || event.kind === "slip") continue;
    const text =
      event.kind === "rocket"
        ? `🚀 ${name(event.runner)} bứt phá từ cuối đoàn!`
        : event.kind === "boost"
          ? `🔥 ${name(event.runner)} tăng tốc!`
          : `${stumble.emoji} ${name(event.runner)} ${stumble.text}`;
    lines.push({ atMs: event.startMs, text, priority: event.kind === "rocket" ? 2 : 1 });
  }
  for (const attack of plan.attacks) {
    const from = name(attack.from);
    const to = name(attack.to);
    if (attack.weapon === "pie") {
      lines.push({ atMs: attack.atMs, text: `🥧 ${from} ném bánh kem vào ${to}!`, priority: 2 });
      if (attack.dodged) lines.push({ atMs: pieLandsMs(attack), text: `😎 ${to} né được!`, priority: 2 });
      else if (attack.hitMs !== null) {
        lines.push({ atMs: attack.hitMs, text: `🤡 ${to} dính trọn bánh kem!`, priority: 2 });
      }
    } else {
      lines.push({ atMs: attack.atMs, text: `🍌 ${from} thả vỏ chuối cho ${to}!`, priority: 1 });
      if (attack.hitMs !== null) {
        lines.push({
          atMs: attack.hitMs,
          text: attack.dodged ? `🤸 ${to} nhảy qua vỏ chuối!` : `🍌 ${to} trượt vỏ chuối!`,
          priority: 2,
        });
      }
    }
  }
  if (plan.photoFinish) {
    lines.push({ atMs: plan.durationMs - SLOW_BEFORE_MS, text: "📸 Sát nút! Xem chậm…", priority: 3 });
  }
  lines.push({ atMs: plan.durationMs, text: `🏁 ${name(plan.ranking[0])} về nhất!`, priority: 4 });
  return lines;
}

/** The pose for what a runner is in the middle of. */
function poseFor(event: RaceEvent | null): PoseMode {
  switch (event?.kind) {
    case undefined:
      return "run";
    case "boost":
    case "rocket":
      return "boost";
    case "stumble":
    case "splat":
      return "stumble";
    case "throw":
      return "throw";
    case "slip":
      return "slip";
  }
}

/** A peel is in the air this long before it lies on the track. */
const PEEL_FLIGHT_MS = STEP_MS;

/** When the race is over: the podium home, give or take. */
export function raceEndMs(plan: RacePlan): number {
  const podium = plan.ranking.slice(0, 3).map((index) => plan.runners[index].finishMs);
  const home = podium.every((ms) => ms !== null) ? Math.max(...(podium as number[])) : Infinity;
  return Math.min(plan.durationMs + MAX_AFTER_WINNER_MS, home + AFTER_PODIUM_MS);
}

/**
 * The race on a canvas, filmed from the side: lanes stacked on a slant, the
 * camera following the leaders along a track longer than the screen, and the
 * finish line rolling in at the end. A runner has finished only once their
 * whole body is across it; the race runs on until the podium is home. Starts
 * its countdown the moment it mounts — remount it (a new `key`) to race again
 * — and calls `onFinish` once, when it is over.
 */
export function RaceTrack({
  plan,
  kind,
  onFinish,
  record = false,
  onRecorded,
}: {
  plan: RacePlan;
  kind: RacerKind;
  onFinish: () => void;
  /**
   * Film the canvas, countdown to finish, and hand the video to `onRecorded` —
   * or `null` straight away if this browser turns out unable to film it.
   */
  record?: boolean;
  onRecorded?: (video: Blob | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef(onFinish);
  const recordedRef = useRef(onRecorded);
  useEffect(() => {
    finishRef.current = onFinish;
    recordedRef.current = onRecorded;
  }, [onFinish, onRecorded]);

  const lanes = plan.runners.length;
  const height = trackHeight(lanes);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const start = performance.now() + COUNTDOWN_MS;
    const clock = raceClock(plan);
    const endMs = raceEndMs(plan);
    const lines = commentary(plan, kind);
    let frame = 0;
    let finished = false;
    let disposed = false;
    const winner = plan.ranking[0];
    const place = new Map(plan.ranking.map((runner, i) => [runner, i]));
    const racer = RACERS[kind];
    const scene = racer.scene;

    const pixel = lanes <= 6 ? 2.5 : lanes <= 12 ? 2 : 1.5;
    const modelHeight = racer.model ? racer.model.cells * pixel : 0;
    const bodyWidth = racer.model ? modelHeight * racer.model.length : racer.stand.width * pixel;
    const bodyHeight = racer.model ? modelHeight * 0.92 : racer.stand.height * pixel;
    const horizon = Math.round(height * 0.3);
    const firstFoot = horizon + 12 + bodyHeight;
    const lastFoot = height - 10;
    const spacing = lanes > 1 ? (lastFoot - firstFoot) / (lanes - 1) : 0;
    /** Lane 0 is the back row, at the top; the back leans right, like a grid seen from the stands. */
    const footY = (lane: number) => firstFoot + lane * spacing;
    const lean = (lane: number) => (lanes - 1 - lane) * spacing * LEAN;
    const startX = 24 + bodyWidth;
    const tagFont = `600 ${lanes <= 12 ? 11 : 10}px ui-sans-serif, system-ui, sans-serif`;
    const tagHeight = lanes <= 12 ? 16 : 14;
    const emojiSize = lanes <= 12 ? 16 : 12;

    // The 3D models are rendered to sprite sheets during the countdown; until
    // they are ready (or if WebGL is missing) the pixel sprites stand in.
    let models: ModelFrames | null = null;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    // Each duck gets a costume, dealt from a fresh shuffle every race so
    // nobody is always the one in the swim ring. Only looks, not odds.
    const deck = [...DUCK_LOOKS].sort(() => Math.random() - 0.5);
    const looks: Look[] = plan.runners.map((_, lane) => ({
      look: racer.model?.kind === "duck" ? deck[lane % deck.length] : "default",
      color: COLORS[lane % COLORS.length],
    }));
    if (racer.model) {
      const unique = [...new Map(looks.map((look) => [lookKey(look), look])).values()];
      buildModelFrames(racer.model.kind, unique, modelHeight, ratio)
        .then((built) => {
          if (disposed) return;
          models = built;
          if (finished) draw(endMs);
        })
        .catch((error) => console.error("Could not build the 3D racers", error));
    }

    // Everything below depends on the canvas's width and is worked out in
    // `size()`: per frame there is only copying images and a little text.
    let width = 0;
    let run = 0;
    let finishX = 0;
    let overrun = 0;
    let paint = spriteCache(1);
    let sky = offscreen(1, 1, 1).canvas;
    let mesas = sky;
    let ground = sky;
    let line = sky;
    let lineWidth = 0;
    let groundHeight = 0;
    let roadside: number[] = [];
    let tags: HTMLCanvasElement[] = [];
    let winnerTag = sky;
    let tagWidths: number[] = [];
    const MESA_TILE = 520;
    const GROUND_TILE = 240;

    const size = () => {
      width = canvas.clientWidth;
      // Past 2× the extra pixels are invisible on pixel art but still paid for.
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      paint = spriteCache(ratio);
      run = Math.max(width * 1.2, (SPEED * plan.durationMs) / 1000);
      // The line sits a body's length (and its own width) short of where the
      // nose is at progress 1, so at 1 the tail is clear of it.
      finishX = startX + run - bodyWidth - CHECK * 2 - 6;
      overrun = Math.min(90, width * 0.18);

      // Sky and the flat ground under everything: never moves.
      const back = offscreen(width, height, ratio);
      const gradient = back.context.createLinearGradient(0, 0, 0, horizon);
      gradient.addColorStop(0, scene.skyTop);
      gradient.addColorStop(1, scene.skyBottom);
      back.context.fillStyle = gradient;
      back.context.fillRect(0, 0, width, horizon);
      back.context.fillStyle = scene.ground;
      back.context.fillRect(0, horizon, width, height - horizon);
      back.context.fillStyle = scene.edge;
      back.context.fillRect(0, horizon, width, scene.edgeHeight);
      if (scene.marks === "lanes") {
        // Lane lines run the length of the course, so they need no scrolling.
        back.context.fillStyle = scene.mark;
        for (let lane = 0; lane < lanes; lane++) back.context.fillRect(0, Math.round(footY(lane)) + 2, width, 1);
      }
      sky = back.canvas;

      // Mesas or hills on the horizon, scrolled slower than the ground.
      const far = offscreen(MESA_TILE, 60, ratio);
      for (let x = 20; x < MESA_TILE - 60; x += 140 + Math.random() * 120) {
        const w = 50 + Math.random() * 70;
        const h = 18 + Math.random() * 34;
        far.context.fillStyle = scene.farColor;
        far.context.beginPath();
        if (scene.far === "mesas") {
          far.context.moveTo(x, 60);
          far.context.lineTo(x + 12, 60 - h);
          far.context.lineTo(x + w - 12, 60 - h);
          far.context.lineTo(x + w, 60);
          far.context.fill();
          far.context.fillStyle = scene.farShade;
          far.context.fillRect(x + 10, 60 - h, w - 20, 4);
        } else {
          far.context.ellipse(x + w / 2, 60, w * 0.75, h * 0.8, 0, Math.PI, 0);
          far.context.fill();
          far.context.fillStyle = scene.farShade;
          far.context.beginPath();
          far.context.ellipse(x + w * 0.7, 60, w * 0.4, h * 0.45, 0, Math.PI, 0);
          far.context.fill();
        }
      }
      mesas = far.canvas;

      // Pebbles, ripples or track specks, scrolled with the runners so the ground visibly moves.
      groundHeight = height - horizon - 4;
      const near = offscreen(GROUND_TILE, groundHeight, ratio);
      near.context.fillStyle = scene.mark;
      const count = scene.marks === "lanes" ? groundHeight / 8 : groundHeight / 3;
      for (let i = 0; i < count; i++) {
        const length = scene.marks === "ripples" ? 4 + Math.floor(Math.random() * 4) * 2 : 1 + Math.floor(Math.random() * 3) * 2;
        near.context.fillRect(
          Math.floor(Math.random() * GROUND_TILE),
          scene.edgeHeight + Math.floor(Math.random() * (groundHeight - scene.edgeHeight)),
          length,
          1,
        );
      }
      ground = near.canvas;

      // A checkered strip leaning with the lanes: the start and the finish.
      const top = horizon + 6;
      const bottom = height - 2;
      lineWidth = (bottom - top) * LEAN + CHECK * 2;
      const strip = offscreen(lineWidth, height, ratio);
      for (let y = top, row = 0; y < bottom; y += CHECK, row++) {
        const shift = (bottom - y) * LEAN;
        strip.context.fillStyle = SCENE.tag;
        strip.context.fillRect(shift, y, CHECK * 2, CHECK);
        strip.context.fillStyle = SCENE.check;
        strip.context.fillRect(shift + (row % 2) * CHECK, y, CHECK, CHECK);
      }
      line = strip.canvas;

      // Cacti, reeds or bushes along the back of the track, every few hundred px of the course.
      roadside = [];
      for (let x = 80 + Math.random() * 200; x < run + width * 2; x += 180 + Math.random() * 260) {
        roadside.push(x);
      }

      // A name tag per runner, painted once; the winner's turns gold at the line.
      const makeTag = (name: string, color: string, fill: string, textColor: string) => {
        context.font = tagFont;
        const text = ellipsize(context, name, lanes <= 12 ? 84 : 64);
        const w = Math.ceil(context.measureText(text).width) + 12;
        const t = offscreen(w, tagHeight, ratio);
        t.context.fillStyle = fill;
        t.context.fillRect(0, 0, w, tagHeight);
        t.context.fillStyle = color;
        t.context.fillRect(0, 0, 3, tagHeight);
        t.context.fillStyle = textColor;
        t.context.font = tagFont;
        t.context.textBaseline = "middle";
        t.context.fillText(text, 7, tagHeight / 2 + 0.5);
        return { canvas: t.canvas, w };
      };
      const made = plan.runners.map((runner, lane) =>
        makeTag(runner.name, COLORS[lane % COLORS.length], SCENE.tag, SCENE.tagText),
      );
      tags = made.map((tag) => tag.canvas);
      tagWidths = made.map((tag) => tag.w);
      winnerTag = makeTag(plan.runners[winner].name, SCENE.check, SCENE.gold, SCENE.tagText).canvas;
    };

    /**
     * Where each runner's nose is on the course, in world px. The leader is
     * placed along the full course — until they cross, after which the line is
     * the anchor — and everyone else by their gap to it. Small gaps are drawn
     * true, so a close finish looks close; big ones are squeezed so the tail
     * of the field stays on screen, where the point of the picture is to see
     * the pack race for the line. Past the line a runner coasts to a stop.
     */
    const nosesAt = (elapsed: number) => {
      const progress = plan.runners.map((runner) => progressAt(runner, elapsed));
      const anchor = Math.min(1, Math.max(...progress));
      // No gap is drawn wider than half the screen: whoever is last is still
      // in shot, to be seen throwing and being thrown at.
      const gapScale = Math.min(run, width * 0.55);
      const squeeze = (gap: number) => gapScale * (1 - Math.exp((-run * gap) / gapScale));
      /** Where a nose at `p` is drawn in `lane` — for a runner, or a peel lying in wait. */
      const place = (p: number, lane: number) => {
        const base = startX + lean(lane);
        if (p <= 1) return base + anchor * run - squeeze(Math.max(0, anchor - p));
        return base + run + overrun * (1 - Math.exp((-(p - 1) * run) / overrun));
      };
      return { progress, noses: progress.map(place), place };
    };

    const cameraFor = (noses: number[]) => {
      const leader = Math.max(...noses);
      // Keep the leaders around the right third, until the finish line is in
      // view — then the camera stops and the field runs across it.
      const stop = Math.max(0, finishX - width * 0.55);
      return Math.min(stop, Math.max(0, leader - width * 0.62));
    };

    const emoji = (text: string, x: number, y: number, size = emojiSize) => {
      context.font = `${size}px ${EMOJI_FONT}`;
      // Colour emoji still take the fill's alpha — the shadow's would fade them.
      context.fillStyle = "#000000";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(text, x, y);
    };

    const draw = (elapsed: number) => {
      const done = elapsed >= endMs;
      const { progress, noses: world, place: placeAt } = nosesAt(elapsed);
      // Straight from the leader, not eased: the leader's position is already
      // continuous, and an eased camera falls behind whenever frames are dropped.
      const camera = cameraFor(world);

      context.drawImage(sky, 0, 0, width, height);

      context.globalAlpha = 0.9;
      for (const [i, y] of [14, 34, 22].entries()) {
        const x = ((i * 0.37 + 0.1) * (width + 80) - camera * 0.08 - elapsed * 0.004) % (width + 80);
        paint(context, CLOUD, (x + width + 80) % (width + 80) - 40, y, 2, SCENE.cloud);
      }
      context.globalAlpha = 1;
      tile(context, mesas, MESA_TILE, 60, camera * 0.3, horizon - 57, width);
      tile(context, ground, GROUND_TILE, groundHeight, camera, horizon + 4, width);

      for (const x of roadside) {
        const screen = x - camera;
        if (screen > -40 && screen < width + 10) {
          paint(context, scene.prop, screen, horizon + 8 - scene.prop.height * 2, 2, scene.propColor);
        }
      }

      // The start line leaves on the left; the finish rolls in on the right.
      for (const at of [startX, finishX]) {
        const x = at - camera - CHECK;
        if (x > -lineWidth && x < width) context.drawImage(line, x, 0, lineWidth, height);
      }

      const noses = world.map((x) => x - camera);
      // Where each head is, for pies to fly between; refined as runners are drawn.
      const heads = noses.map((nose, lane) => ({ x: nose - bodyWidth / 2, y: footY(lane) - bodyHeight }));

      // Banana peels lying in wait, and squashed for a moment once stepped on.
      for (const attack of plan.attacks) {
        if (attack.weapon !== "banana" || elapsed < attack.atMs + PEEL_FLIGHT_MS) continue;
        if (attack.hitMs !== null && elapsed > attack.hitMs + 400) continue;
        const x = placeAt(attack.at, attack.to) - camera;
        if (x < -20 || x > width + 20) continue;
        const squashed = attack.hitMs !== null && !attack.dodged && elapsed >= attack.hitMs;
        emoji("🍌", x, footY(attack.to) + 3, squashed ? emojiSize * 0.8 : emojiSize);
      }

      // Back row first, so nearer runners stand in front.
      for (let lane = 0; lane < lanes; lane++) {
        const nose = noses[lane];
        const foot = footY(lane);
        if (nose < -10 || nose - bodyWidth > width + 10) continue;

        const runner = plan.runners[lane];
        const home = runner.finishMs !== null && elapsed >= runner.finishMs;
        const event = elapsed > 0 && !home ? eventAt(plan, lane, elapsed) : null;
        const stopped = elapsed <= 0 || (home && elapsed - runner.finishMs! > 700);
        const mode: PoseMode = stopped ? "stand" : poseFor(event);
        const travelled = progress[lane] * run;
        const color = COLORS[lane % COLORS.length];
        const tail = nose - bodyWidth;
        const eventT = event ? (elapsed - event.startMs) / (event.endMs - event.startMs) : 0;

        // Speed lines streaming off a burst.
        if (mode === "boost") {
          context.strokeStyle = event?.kind === "rocket" ? "rgba(251, 146, 60, 0.85)" : "rgba(255, 255, 255, 0.85)";
          context.lineWidth = 1.5;
          for (let i = 0; i < 3; i++) {
            const y = foot - bodyHeight * (0.25 + i * 0.25);
            const jitter = ((elapsed / 40 + i * 7 + lane * 3) % 10) * 1.5;
            context.beginPath();
            context.moveTo(tail - 4 - jitter, y);
            context.lineTo(tail - 22 - jitter - i * 4, y);
            context.stroke();
          }
        }

        if (racer.grounded) {
          context.fillStyle = SCENE.shadow;
          context.beginPath();
          context.ellipse(nose - bodyWidth * 0.55, foot, bodyWidth * 0.45, 2.5 * pixel, 0, 0, Math.PI * 2);
          context.fill();
        } else if (mode !== "stand") {
          // A wake behind a swimming duck.
          context.strokeStyle = "rgba(255, 255, 255, 0.7)";
          context.lineWidth = 1.2;
          for (let i = 0; i < 2; i++) {
            const x = tail - 2 - i * 9 - ((travelled / 3) % 9);
            context.beginPath();
            context.ellipse(x, foot - 1, 5 + i * 3, 1.6, 0, 0, Math.PI * 2);
            context.stroke();
          }
        }

        let headY: number;
        // Where the crown and the event icons are centred.
        let headX = nose - bodyWidth * 0.45;
        if (models) {
          const sheet = models.sheets.get(lookKey(looks[lane]))!;
          const stride = mode === "boost" ? pixel * 2 : pixel * 3;
          const index = sheetFrame(
            mode,
            mode === "stumble" || mode === "throw" || mode === "slip"
              ? Math.floor(eventT * moveFrames(mode))
              : Math.floor(travelled / stride),
          );
          const source = sheet.width / SHEET_FRAMES;
          context.drawImage(
            sheet,
            index * source,
            0,
            source,
            sheet.height,
            nose - models.noseX,
            foot - models.footY,
            models.width,
            models.height,
          );
          headY = foot - models.footY;
          headX = nose - models.noseX + models.footX;
        } else {
          const stride = Math.floor(travelled / ((mode === "boost" ? 3 : 5) * pixel)) % 2;
          const art = mode === "run" || mode === "boost" || mode === "throw" ? racer.run[stride] : racer.stand;
          const spriteHeight = art.height * pixel;
          const bob = racer.grounded
            ? (mode === "run" || mode === "boost" || mode === "throw") && stride ? pixel : 0
            : // Afloat: a slow bob on the water, out of step lane to lane, even at rest.
              (Math.sin(travelled / 14 + lane * 1.7 + Math.max(0, elapsed) / 300) + 1) * pixel;
          if (mode === "stumble" || mode === "slip") {
            // A wobble forward (or, off a peel, backward) and back onto its feet.
            const tilt = mode === "slip" ? -0.9 : 0.6;
            context.save();
            context.translate(nose - bodyWidth / 2, foot);
            context.rotate(tilt * Math.sin(Math.PI * eventT) * (racer.grounded ? 1 : Math.sin(eventT * 12)));
            paint(context, art, -bodyWidth / 2, -spriteHeight, pixel, color);
            context.restore();
          } else {
            paint(context, art, nose - bodyWidth, foot - spriteHeight - bob, pixel, color);
          }
          headY = foot - spriteHeight - bob;
        }

        heads[lane] = { x: headX, y: headY + bodyHeight * 0.12 };
        const icon =
          event?.kind === "stumble"
            ? racer.stumble.emoji
            : event?.kind === "rocket"
              ? "🚀"
              : event?.kind === "boost"
                ? "🔥"
                : event?.kind === "splat"
                  ? "🤡"
                  : event?.kind === "slip"
                    ? "💫"
                    : null;
        if (icon) emoji(icon, headX, headY + 2);
        if (home && lane === winner) {
          paint(context, CROWN, headX - (CROWN.width * pixel) / 2, headY - CROWN.height * pixel - 2, pixel, SCENE.gold);
        }
      }

      // Pies in the air, arcing from the thrower's hand to the target's face —
      // or sailing over a ducked head — and peels on their way to the track.
      for (const attack of plan.attacks) {
        const lands = attack.weapon === "pie" ? pieLandsMs(attack) : attack.atMs + PEEL_FLIGHT_MS;
        // A dodged pie flies on for a moment past where the face was.
        const flightEnd = attack.dodged ? lands + 250 : lands;
        // The arm is still winding up for the first moment of the throw.
        const release = attack.atMs + 120;
        if (elapsed < release || elapsed >= flightEnd) continue;
        const u = (elapsed - release) / (lands - release);
        const from = heads[attack.from];
        let toX: number;
        let toY: number;
        if (attack.weapon === "pie") {
          toX = heads[attack.to].x;
          toY = heads[attack.to].y - (attack.dodged ? bodyHeight * 0.5 : 0);
        } else {
          toX = placeAt(attack.at, attack.to) - camera;
          toY = footY(attack.to);
        }
        const x = from.x + (toX - from.x) * u;
        const y = from.y + (toY - from.y) * u - Math.sin(Math.PI * Math.min(u, 1)) * (18 + bodyHeight * 0.4);
        emoji(attack.weapon === "pie" ? "🥧" : "🍌", x, y + emojiSize / 2);
      }

      // Tags over the runners, after all of them, so none is hidden by a neighbour.
      for (let lane = 0; lane < lanes; lane++) {
        const w = tagWidths[lane];
        // Trailing just behind the runner, so it never covers its own racer —
        // except on the start line, where it is kept on screen instead.
        const x = Math.max(2, Math.round(noses[lane] - bodyWidth - w - 2));
        if (x > width || x + w < 0) continue;
        const y = Math.round(footY(lane) - bodyHeight * 0.5 - tagHeight / 2);
        const finish = plan.runners[lane].finishMs;
        const home = finish !== null && elapsed >= finish;
        context.drawImage(home && lane === winner ? winnerTag : tags[lane], x, y, w, tagHeight);
        const medal = MEDALS[place.get(lane)!];
        if (home && medal) emoji(medal, x - 8, y + tagHeight + 1, tagHeight - 2);
      }

      // The clock, top centre: counting down to the winner, then held there.
      const clockLabel = clockText(plan.durationMs - Math.max(0, elapsed));
      const clockSize = width < 400 ? 18 : 22;
      context.font = `700 ${clockSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const clockWidth = context.measureText(clockLabel).width + 20;
      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.fillRect(Math.round(width / 2 - clockWidth / 2), 8, Math.round(clockWidth), clockSize + 12);
      context.fillStyle = elapsed >= plan.durationMs ? SCENE.gold : SCENE.tagText;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(clockLabel, width / 2, 8 + (clockSize + 12) / 2 + 1);

      // The commentator, under the clock: the most important recent line. The
      // winner's is never replaced — it is what the race ends on.
      let said: Line | null = null;
      for (const entry of lines) {
        const lasts = entry.priority >= 4 ? Infinity : entry.priority === 3 ? 2600 : 1600;
        if (entry.atMs > elapsed || elapsed - entry.atMs > lasts) continue;
        if (!said || entry.priority > said.priority || (entry.priority === said.priority && entry.atMs > said.atMs)) {
          said = entry;
        }
      }
      if (said && elapsed > 0) {
        context.font = `600 ${width < 400 ? 12 : 13}px ui-sans-serif, system-ui, sans-serif, ${EMOJI_FONT}`;
        const text = ellipsize(context, said.text, width - 40);
        const w = context.measureText(text).width + 20;
        const y = 8 + clockSize + 12 + 6;
        context.fillStyle = SCENE.banner;
        context.beginPath();
        context.roundRect(width / 2 - w / 2, y, w, 22, 11);
        context.fill();
        context.fillStyle = "#ffffff";
        context.textBaseline = "middle";
        context.fillText(text, width / 2, y + 11.5);
      }

      // Slow motion: a letterbox, like a replay.
      if (clock.slow(elapsed) && !done) {
        context.fillStyle = "rgba(0, 0, 0, 0.55)";
        context.fillRect(0, 0, width, 5);
        context.fillRect(0, height - 5, width, 5);
      }

      // 3, 2, 1, CHẠY! over the whole track.
      if (elapsed < 700) {
        const text = elapsed < 0 ? String(Math.ceil(-elapsed / 1000)) : "CHẠY!";
        context.font = `800 ${Math.min(64, height * 0.3)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.lineWidth = 6;
        context.strokeStyle = "#ffffff";
        context.strokeText(text, width / 2, height * 0.55);
        context.fillStyle = SCENE.tagText;
        context.fillText(text, width / 2, height * 0.55);
      }
    };

    // Filming, when asked for. A stream only gets frames the canvas paints, so
    // the final frame is repainted for HOLD_MS after the end — without that the
    // video would stop the instant the race does, before anyone sees it.
    let recorder: MediaRecorder | null = null;
    let discarded = false;
    const startRecording = () => {
      if (!record) return;
      const type = pickVideoType();
      if (!type || typeof canvas.captureStream !== "function") {
        recordedRef.current?.(null);
        return;
      }
      try {
        const chunks: Blob[] = [];
        recorder = new MediaRecorder(canvas.captureStream(30), {
          mimeType: type,
          videoBitsPerSecond: 2_500_000,
        });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (!discarded) recordedRef.current?.(new Blob(chunks, { type }));
        };
        recorder.start(1000);
      } catch (error) {
        // A browser that lists the type but refuses it: race on, unrecorded.
        console.error("Could not record the race", error);
        recorder = null;
        recordedRef.current?.(null);
      }
    };

    let endedAt = 0;
    const tick = (now: number) => {
      const elapsed = Math.min(endMs, clock.at(now - start));
      draw(elapsed);
      if (elapsed >= endMs) {
        if (!finished) {
          finished = true;
          endedAt = now;
          finishRef.current();
        }
        if (recorder?.state === "recording") {
          if (now - endedAt < HOLD_MS) frame = requestAnimationFrame(tick);
          else recorder.stop();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    size();
    startRecording();
    frame = requestAnimationFrame(tick);

    // A resize mid-race is redrawn on the next frame; after the end, now.
    const observer = new ResizeObserver(() => {
      size();
      if (finished) draw(endMs);
    });
    observer.observe(canvas);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      // Stopped or left mid-race: that film is thrown away, not handed over.
      discarded = true;
      if (recorder?.state === "recording") recorder.stop();
    };
  }, [plan, height, lanes, kind, record]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Đua vui: ${plan.runners.map((runner) => runner.name).join(", ")}`}
      className="block w-full rounded-md"
      style={{ height }}
    />
  );
}
