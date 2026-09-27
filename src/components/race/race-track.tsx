"use client";

import { useEffect, useRef } from "react";

import { progressAt, type RacePlan } from "@/lib/dino-race";
import { CLOUD, CROWN, spriteCache } from "./pixel-art";
import { RACERS, type RacerKind } from "./racers";
import { pickVideoType } from "./recording";

/** 3, 2, 1 — then the race clock starts. */
export const COUNTDOWN_MS = 3000;
/** How long a recording lingers on the finish before it ends. */
const HOLD_MS = 2000;

/**
 * How fast the field moves across the ground, px/s. The track is as long as
 * the time needs at this pace, so a 60-second race covers many screens and the
 * camera follows the pack instead of shrinking everyone onto one.
 */
const SPEED = 150;

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
};

/** One colour per lane, so a runner can be followed through a crowd. */
const COLORS = [
  "#16a34a", "#2563eb", "#dc2626", "#9333ea", "#ea580c",
  "#0891b2", "#db2777", "#65a30d", "#4f46e5", "#a16207",
];

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
 * The race on a canvas, filmed from the side: lanes stacked on a slant, the
 * camera following the leaders along a track longer than the screen, and the
 * finish line rolling in at the end. Starts its countdown the moment it
 * mounts — remount it (a new `key`) to race again — and calls `onFinish`
 * once, when the time is up.
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
    let frame = 0;
    let finished = false;
    const winner = plan.ranking[0];
    const racer = RACERS[kind];
    const scene = racer.scene;

    const pixel = lanes <= 6 ? 2.5 : lanes <= 12 ? 2 : 1.5;
    const bodyWidth = racer.stand.width * pixel;
    const bodyHeight = racer.stand.height * pixel;
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

    // Everything below depends on the canvas's width and is worked out in
    // `size()`: per frame there is only copying images and a little text.
    let width = 0;
    let run = 0;
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
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
      paint = spriteCache(ratio);
      run = Math.max(width * 1.2, (SPEED * plan.durationMs) / 1000);

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

      // A name tag per runner, painted once; the winner's is gold.
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
     * placed along the full course, but everyone's gap to the leader is scaled
     * to at most ~1.4 screens: on a long course the true gaps span thousands
     * of px and the tail of the field would vanish off the left edge, where
     * the point of the picture is to see the whole pack race for the line.
     */
    const nosesAt = (elapsed: number) => {
      const progress = plan.runners.map((runner) => progressAt(runner, elapsed, plan.durationMs));
      const lead = Math.max(...progress);
      const gapScale = Math.min(run, width * 1.4);
      return progress.map((p, lane) => startX + lean(lane) + lead * run - (lead - p) * gapScale);
    };

    const cameraFor = (noses: number[]) => {
      const leader = Math.max(...noses);
      // Keep the leaders around the right third, until the finish line is in
      // view — then the camera stops and the field runs across it.
      const stop = Math.max(0, startX + run - width * 0.72);
      return Math.min(stop, Math.max(0, leader - width * 0.62));
    };

    const draw = (elapsed: number) => {
      const done = elapsed >= plan.durationMs;
      const world = nosesAt(elapsed);
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
      for (const at of [startX, startX + run]) {
        const x = at - camera - CHECK;
        if (x > -lineWidth && x < width) context.drawImage(line, x, 0, lineWidth, height);
      }

      // Back row first, so nearer runners stand in front.
      const noses = world.map((x) => x - camera);
      for (let lane = 0; lane < lanes; lane++) {
        const nose = noses[lane];
        const foot = footY(lane);
        if (nose < -10 || nose - bodyWidth > width + 10) continue;

        const running = elapsed > 0 && !done;
        const travelled = world[lane] - startX;
        const stride = Math.floor(travelled / (5 * pixel)) % 2;
        const art = running ? racer.run[stride] : racer.stand;
        let bob: number;
        if (racer.grounded) {
          context.fillStyle = SCENE.shadow;
          context.beginPath();
          context.ellipse(nose - bodyWidth * 0.55, foot, bodyWidth * 0.4, 2.5 * pixel, 0, 0, Math.PI * 2);
          context.fill();
          bob = running && stride ? pixel : 0;
        } else {
          // Afloat: a slow bob on the water, out of step lane to lane, even at rest.
          bob = (Math.sin(travelled / 14 + lane * 1.7 + Math.max(0, elapsed) / 300) + 1) * pixel;
        }
        const color = COLORS[lane % COLORS.length];
        paint(context, art, nose - bodyWidth, foot - bodyHeight - bob, pixel, color);
        if (done && lane === winner) {
          paint(context, CROWN, nose - bodyWidth * 0.3, foot - bodyHeight - CROWN.height * pixel - pixel, pixel, SCENE.gold);
        }
      }

      // Tags over the runners, after all of them, so none is hidden by a neighbour.
      for (let lane = 0; lane < lanes; lane++) {
        const w = tagWidths[lane];
        // Trailing just behind the runner, so it never covers its own racer —
        // except on the start line, where it is kept on screen instead.
        const x = Math.max(2, Math.round(noses[lane] - bodyWidth - w - 2));
        if (x > width || x + w < 0) continue;
        const y = Math.round(footY(lane) - bodyHeight * 0.5 - tagHeight / 2);
        context.drawImage(done && lane === winner ? winnerTag : tags[lane], x, y, w, tagHeight);
      }

      // The clock, top centre.
      const clock = clockText(plan.durationMs - Math.max(0, elapsed));
      const clockSize = width < 400 ? 18 : 22;
      context.font = `700 ${clockSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      const clockWidth = context.measureText(clock).width + 20;
      context.fillStyle = "rgba(255, 255, 255, 0.92)";
      context.fillRect(Math.round(width / 2 - clockWidth / 2), 8, Math.round(clockWidth), clockSize + 12);
      context.fillStyle = done ? SCENE.gold : SCENE.tagText;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(clock, width / 2, 8 + (clockSize + 12) / 2 + 1);

      // 3, 2, 1, CHẠY! over the whole track.
      if (elapsed < 700) {
        const text = elapsed < 0 ? String(Math.ceil(-elapsed / 1000)) : "CHẠY!";
        context.font = `800 ${Math.min(64, height * 0.3)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.lineWidth = 6;
        context.strokeStyle = "#ffffff";
        context.strokeText(text, width / 2, height * 0.55);
        context.fillStyle = SCENE.tagText;
        context.fillText(text, width / 2, height * 0.55);
      }
    };

    // Filming, when asked for. A stream only gets frames the canvas paints, so
    // the final frame is repainted for HOLD_MS after the line — without that the
    // video would end the instant the winner crosses, before anyone sees it.
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

    const tick = (now: number) => {
      const elapsed = now - start;
      draw(elapsed);
      if (elapsed >= plan.durationMs) {
        if (!finished) {
          finished = true;
          finishRef.current();
        }
        if (recorder?.state === "recording") {
          if (elapsed < plan.durationMs + HOLD_MS) frame = requestAnimationFrame(tick);
          else recorder.stop();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    size();
    startRecording();
    frame = requestAnimationFrame(tick);

    // A resize mid-race is redrawn on the next frame; after the line, now.
    const observer = new ResizeObserver(() => {
      size();
      if (finished) draw(plan.durationMs);
    });
    observer.observe(canvas);

    return () => {
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
      aria-label={`Đua khủng long: ${plan.runners.map((runner) => runner.name).join(", ")}`}
      className="block w-full rounded-md"
      style={{ height }}
    />
  );
}
