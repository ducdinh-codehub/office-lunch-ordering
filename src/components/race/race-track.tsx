"use client";

import { useEffect, useMemo, useRef } from "react";

import { progressAt, type RacePlan } from "@/lib/dino-race";
import {
  CACTUS,
  CLOUD,
  DINO_HEIGHT,
  DINO_RUN_A,
  DINO_RUN_B,
  DINO_STAND,
  DINO_WIDTH,
  drawSprite,
} from "./pixel-art";

/** 3, 2, 1 — then the race clock starts. */
export const COUNTDOWN_MS = 3000;
const GOLD = "#d97706";
const SKY = 36;

/** Taller lanes and bigger dinos for a small field; a crowd gets packed tighter. */
function laneHeightFor(count: number): number {
  if (count <= 6) return 72;
  if (count <= 10) return 56;
  if (count <= 18) return 40;
  return 32;
}

type Scenery = {
  /** Per lane: cacti as fractions of the track. */
  cacti: number[][];
  /** Per lane: pebbles under the ground line — [fraction, depth, length]. */
  pebbles: [number, number, number][][];
  clouds: { x: number; y: number }[];
};

/** Laid out once per race so nothing jumps between frames. */
function makeScenery(lanes: number): Scenery {
  const cacti = Array.from({ length: lanes }, () => {
    const first = 0.18 + Math.random() * 0.3;
    // Some lanes get a second cactus, far enough on that the jumps don't merge.
    return Math.random() < 0.6 ? [first, Math.min(0.85, first + 0.25 + Math.random() * 0.25)] : [first];
  });
  const pebbles = Array.from({ length: lanes }, () =>
    Array.from({ length: 10 }, () => [Math.random(), 1 + Math.floor(Math.random() * 3), 1 + Math.floor(Math.random() * 3)] as [number, number, number]),
  );
  const clouds = [0.15, 0.5, 0.82].map((x) => ({ x, y: 6 + Math.random() * 14 }));
  return { cacti, pebbles, clouds };
}

function ellipsize(context: CanvasRenderingContext2D, text: string, width: number): string {
  if (context.measureText(text).width <= width) return text;
  let cut = text;
  while (cut.length > 1 && context.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
  return `${cut}…`;
}

/**
 * The race on a canvas. Starts its countdown the moment it mounts — remount it
 * (a new `key`) to race again — and calls `onFinish` once, when the time is up.
 */
export function RaceTrack({ plan, onFinish }: { plan: RacePlan; onFinish: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  const lanes = plan.runners.length;
  const laneHeight = laneHeightFor(lanes);
  const height = SKY + lanes * laneHeight + 8;
  // New scenery per race comes free: each race remounts the track (see `key`).
  const scenery = useMemo(() => makeScenery(lanes), [lanes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const start = performance.now() + COUNTDOWN_MS;
    let width = canvas.clientWidth;
    let frame = 0;
    let finished = false;
    const winner = plan.ranking[0];
    const places = new Map(plan.ranking.map((runner, place) => [runner, place + 1]));

    const size = () => {
      width = canvas.clientWidth;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.imageSmoothingEnabled = false;
    };

    const draw = (elapsed: number) => {
      const done = elapsed >= plan.durationMs;
      const ink = getComputedStyle(canvas).color;
      const pixel = laneHeight >= 56 ? 2 : 1;
      const dinoWidth = DINO_WIDTH * pixel;
      const dinoHeight = DINO_HEIGHT * pixel;
      const labelWidth = Math.min(150, Math.max(72, width * 0.26));
      const trackLeft = labelWidth + 6;
      const finishX = width - 12;
      const runLength = finishX - trackLeft - dinoWidth;
      const fontSize = laneHeight >= 56 ? 13 : 12;

      context.clearRect(0, 0, width, height);
      context.fillStyle = ink;

      // Clouds drift left behind everything, very faintly.
      context.globalAlpha = 0.25;
      for (const cloud of scenery.clouds) {
        const drift = (((cloud.x - Math.max(0, elapsed) / 60000) % 1) + 1) % 1;
        drawSprite(context, CLOUD, trackLeft + drift * (width - trackLeft), cloud.y, 2);
      }
      context.globalAlpha = 1;

      // The finish line: a checkered strip down every lane.
      const check = 4;
      for (let y = SKY - 6, row = 0; y < height - 4; y += check, row++) {
        context.globalAlpha = 0.55;
        context.fillRect(finishX + (row % 2) * check, y, check, check);
      }
      context.globalAlpha = 1;

      // The clock, top right: what is left, then how long it took.
      context.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      context.textAlign = "right";
      context.textBaseline = "top";
      const clock = Math.max(0, (plan.durationMs - Math.max(0, elapsed)) / 1000);
      context.fillText(done ? "VỀ ĐÍCH" : `${clock.toFixed(1)}s`, width - 4, 6);

      plan.runners.forEach((runner, lane) => {
        const top = SKY + lane * laneHeight;
        const ground = top + laneHeight - 6;
        const progress = progressAt(runner, elapsed, plan.durationMs);
        const x = trackLeft + progress * runLength;

        context.fillStyle = ink;
        context.fillRect(trackLeft, ground, finishX - trackLeft, pixel);
        context.globalAlpha = 0.4;
        for (const [at, depth, length] of scenery.pebbles[lane]) {
          context.fillRect(trackLeft + at * (finishX - trackLeft), ground + depth * 2, length * 2, 1);
        }
        context.globalAlpha = 1;

        // Cacti, and the hop over each: a parabola around the cactus's middle.
        let lift = 0;
        for (const at of scenery.cacti[lane]) {
          const cactusX = trackLeft + dinoWidth + at * (runLength - dinoWidth);
          drawSprite(context, CACTUS, cactusX, ground - CACTUS.height * pixel, pixel);
          const reach = dinoWidth * 0.95;
          const gap = x + dinoWidth / 2 - (cactusX + (CACTUS.width * pixel) / 2);
          if (Math.abs(gap) < reach) lift = Math.max(lift, (1 - (gap / reach) ** 2) * pixel * 12);
        }

        const running = elapsed > 0 && !done && lift === 0;
        const stride = Math.floor((progress * runLength) / (5 * pixel)) % 2;
        const art = running ? (stride ? DINO_RUN_B : DINO_RUN_A) : DINO_STAND;
        if (done && lane === winner) context.fillStyle = GOLD;
        drawSprite(context, art, x, ground - dinoHeight - lift, pixel);

        // The name on the left, and the place once it is over.
        context.fillStyle = done && lane === winner ? GOLD : ink;
        context.font = `${done && lane === winner ? 700 : 500} ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        context.textAlign = "left";
        context.textBaseline = "middle";
        const label = done ? `${places.get(lane)}. ${runner.name}` : runner.name;
        context.fillText(ellipsize(context, label, labelWidth - 4), 4, ground - dinoHeight / 2);
      });

      // 3, 2, 1, CHẠY! over the whole track.
      if (elapsed < 700) {
        const text = elapsed < 0 ? String(Math.ceil(-elapsed / 1000)) : "CHẠY!";
        context.fillStyle = ink;
        context.font = `800 ${Math.min(56, height * 0.4)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(text, width / 2, Math.min(height / 2, SKY + 60));
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
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    size();
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
    };
  }, [plan, height, laneHeight, scenery]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Đua khủng long: ${plan.runners.map((runner) => runner.name).join(", ")}`}
      className="block w-full text-neutral-600 dark:text-neutral-300"
      style={{ height }}
    />
  );
}
