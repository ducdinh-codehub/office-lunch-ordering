"use client";

import { useEffect, useRef, useState } from "react";
import { FastForward, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Kick, ShootoutPlan } from "@/lib/penalty";
import { kickScript, type KickScript, type PenaltyScene } from "./penalty-scene";
import { knockedOut, RULE_EXAMPLE, RULE_SUMMARY } from "./penalty-rules";
import { COLORS } from "./race-track";
import { pickVideoType } from "./recording";

/** How long a recording lingers on the champion before it ends. */
const HOLD_MS = 2000;
const INTRO_MS = 2200;
/** The rules screen: one row of the worked example every RULE_ROW_MS, then a pause to read. */
const RULE_ROW_MS = 2000;
const RULES_MS = 1200 + RULE_EXAMPLE.length * RULE_ROW_MS + 1800;
/** Who went out and who is left: read slowly, it is the part people need to follow. */
const ROUND_BREAK_MS = 4500;
const FINALE_MS = 2600;

const EMOJI_FONT = `"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
const SANS = `ui-sans-serif, system-ui, sans-serif, ${EMOJI_FONT}`;

type Segment =
  | { type: "intro"; start: number; duration: number; speed: number }
  | { type: "rules"; start: number; duration: number; speed: number }
  | { type: "kick"; start: number; duration: number; speed: number; kick: Kick; script: KickScript; index: number }
  | { type: "break"; start: number; duration: number; speed: number; round: number }
  | { type: "finale"; start: number; duration: number; speed: number };

/**
 * A big field makes for a long shootout, so the early rounds are played a
 * little faster the more people are still in — only a little, or nobody can
 * follow it; a final is always at full speed. Tua nhanh is there for more.
 */
function roundSpeed(alive: number): number {
  return alive > 12 ? 1.6 : alive > 6 ? 1.25 : 1;
}

function schedule(plan: ShootoutPlan): Segment[] {
  const segments: Segment[] = [];
  let at = 0;
  // Omit on each member of the union, not on the union as a whole.
  type Unstarted = Segment extends infer S ? (S extends Segment ? Omit<S, "start"> : never) : never;
  const push = (segment: Unstarted) => {
    segments.push({ ...segment, start: at } as Segment);
    at += segment.duration;
  };
  push({ type: "intro", duration: INTRO_MS, speed: 1 });
  push({ type: "rules", duration: RULES_MS, speed: 1 });
  plan.kicks.forEach((kick, index) => {
    const round = plan.rounds[kick.round - 1];
    const script = kickScript(kick, plan.names[kick.shooter], plan.names[kick.keeper]);
    push({ type: "kick", duration: script.duration, speed: roundSpeed(round.shooters.length), kick, script, index });
    const last = plan.kicks[index + 1]?.round !== kick.round;
    if (last && plan.kicks[index + 1]) {
      push({ type: "break", duration: ROUND_BREAK_MS, speed: 1, round: kick.round });
    }
  });
  push({ type: "finale", duration: FINALE_MS, speed: 1 });
  return segments;
}

function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The shootout on a canvas: the 3D pitch underneath, and over it everything a
 * broadcast would put there — the score, who is up against whom, the verdict,
 * VAR, the commentary. Starts the moment it mounts; calls `onFinish` once, at
 * the end or on a skip.
 */
export function PenaltyShootout({
  plan,
  onFinish,
  record = false,
  onRecorded,
}: {
  plan: ShootoutPlan;
  onFinish: () => void;
  record?: boolean;
  onRecorded?: (video: Blob | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishRef = useRef(onFinish);
  const recordedRef = useRef(onRecorded);
  const speedRef = useRef(1);
  const skipRef = useRef<() => void>(() => {});
  const [fast, setFast] = useState(false);
  const [ready, setReady] = useState(false);
  const [over, setOver] = useState(false);
  useEffect(() => {
    finishRef.current = onFinish;
    recordedRef.current = onRecorded;
  }, [onFinish, onRecorded]);
  useEffect(() => {
    speedRef.current = fast ? 2.5 : 1;
  }, [fast]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const segments = schedule(plan);
    const total = segments.at(-1)!.start + segments.at(-1)!.duration;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    let width = 0;
    let height = 0;
    let scene: PenaltyScene | null = null;
    let disposed = false;
    let frame = 0;
    let finished = false;
    let endedAt = 0;
    let timeline = 0;
    let last = performance.now();
    let currentKick = -1;

    // Who is still in, and how each kick of the round went, at any moment.
    const aliveBefore = (round: number) => plan.rounds[round - 1]?.shooters.length ?? 1;
    const roundOf = (segment: Segment) =>
      segment.type === "kick" ? segment.kick.round : segment.type === "break" ? segment.round : null;

    const size = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      scene?.setSize(width, height, ratio);
    };

    const pill = (text: string, x: number, y: number, font: string, fill: string, color = "#ffffff", align: CanvasTextAlign = "left") => {
      context.font = font;
      const w = context.measureText(text).width + 18;
      const h = parseInt(font.match(/(\d+)px/)?.[1] ?? "13", 10) + 12;
      const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
      context.fillStyle = fill;
      context.beginPath();
      context.roundRect(left, y, w, h, h / 2);
      context.fill();
      context.fillStyle = color;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, left + w / 2, y + h / 2 + 1);
      return { w, h };
    };

    const dim = (alpha: number) => {
      context.fillStyle = `rgba(10, 15, 30, ${alpha})`;
      context.fillRect(0, 0, width, height);
    };

    const bigText = (lines: string[], y: number, color: string, pop = 1) => {
      const size = Math.min(40, width / 11) * pop;
      context.font = `900 ${size}px ${SANS}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineJoin = "round";
      lines.forEach((line, i) => {
        context.lineWidth = 7;
        context.strokeStyle = "rgba(0, 0, 0, 0.75)";
        context.strokeText(line, width / 2, y + i * size * 1.15);
        context.fillStyle = color;
        context.fillText(line, width / 2, y + i * size * 1.15);
      });
    };

    const kicksBefore = (index: number) => plan.kicks.slice(0, index);

    /**
     * How a shootout works, drawn as the worked example: each round's kicks
     * as chips (✅ through, ❌ out), one round at a time, each with the rule
     * it shows spelled out underneath.
     */
    const drawRules = (local: number, duration: number) => {
      const fade = Math.min(1, local / 300, (duration - local) / 300);
      dim(0.78 * fade);
      context.globalAlpha = Math.max(0, fade);
      const small = width < 420;
      const title = small ? 20 : 26;
      const top = small ? 10 : 18;
      context.font = `900 ${title}px ${SANS}`;
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillStyle = "#facc15";
      context.fillText("LUẬT CHƠI", width / 2, top);
      context.font = `600 ${small ? 11 : 13}px ${SANS}`;
      context.fillStyle = "#e2e8f0";
      const summary = wrap(context, RULE_SUMMARY, width - 30);
      summary.forEach((line, i) => context.fillText(line, width / 2, top + title + 6 + i * (small ? 14 : 17)));

      const rowsTop = top + title + 12 + summary.length * (small ? 14 : 17);
      const rowHeight = Math.min(small ? 62 : 78, (height - rowsTop - 8) / RULE_EXAMPLE.length);
      const labelWidth = small ? 50 : 70;
      const chip = { w: small ? 44 : 60, h: small ? 22 : 28, gap: small ? 6 : 10 };
      const rowWidth = labelWidth + 4 * chip.w + 3 * chip.gap;
      const left = Math.max(10, (width - rowWidth) / 2);

      RULE_EXAMPLE.forEach(({ round, kicks, note }, row) => {
        const shownAt = 800 + row * RULE_ROW_MS;
        if (local < shownAt) return;
        const y = rowsTop + row * rowHeight;
        context.textBaseline = "middle";
        context.textAlign = "left";
        context.font = `800 ${small ? 11 : 13}px ${SANS}`;
        context.fillStyle = "#94a3b8";
        context.fillText(`LƯỢT ${round}`, left, y + chip.h / 2);
        kicks.forEach(([name, scored], i) => {
          // Each kick lands a beat after the last, as it would on the pitch.
          const kickAt = shownAt + 150 + i * 280;
          if (local < kickAt) return;
          const pop = Math.min(1, (local - kickAt) / 150);
          const x = left + labelWidth + i * (chip.w + chip.gap);
          const out = knockedOut(kicks, scored);
          context.globalAlpha = Math.max(0, fade) * pop;
          context.fillStyle = scored ? "#16a34a" : out ? "#dc2626" : "#475569";
          context.beginPath();
          context.roundRect(x, y, chip.w, chip.h, chip.h / 2);
          context.fill();
          context.fillStyle = "#ffffff";
          context.textAlign = "center";
          context.font = `800 ${small ? 11 : 13}px ${SANS}`;
          context.fillText(`${name} ${scored ? "✅" : "❌"}`, x + chip.w / 2, y + chip.h / 2 + 1);
          if (out) {
            // Struck through: this one goes home.
            context.strokeStyle = "#ffffff";
            context.lineWidth = 2;
            context.beginPath();
            context.moveTo(x + 6, y + chip.h / 2);
            context.lineTo(x + chip.w - 6, y + chip.h / 2);
            context.stroke();
          }
          context.globalAlpha = Math.max(0, fade);
        });
        const noteAt = shownAt + 150 + kicks.length * 280 + 200;
        if (local >= noteAt) {
          context.globalAlpha = Math.max(0, fade) * Math.min(1, (local - noteAt) / 250);
          context.textAlign = "left";
          context.font = `700 ${small ? 11 : 13}px ${SANS}`;
          context.fillStyle = row === RULE_EXAMPLE.length - 1 ? "#facc15" : "#ffffff";
          context.fillText(`→ ${note}`, left + labelWidth, y + chip.h + (small ? 11 : 14));
          context.globalAlpha = Math.max(0, fade);
        }
      });
      context.globalAlpha = 1;
    };

    const draw = (at: number) => {
      const index = segments.findIndex((segment) => at < segment.start + segment.duration);
      const segment = segments[index === -1 ? segments.length - 1 : index];
      const local = Math.min(at - segment.start, segment.duration);

      // The pitch: the kick being taken, or the last one frozen at its end.
      let kickSegment: Extract<Segment, { type: "kick" }> | undefined;
      let kickT = 0;
      if (segment.type === "kick") {
        kickSegment = segment;
        kickT = local;
      } else {
        const before = segments.slice(0, index === -1 ? segments.length : index).reverse();
        kickSegment = before.find((s): s is Extract<Segment, { type: "kick" }> => s.type === "kick");
        if (kickSegment) kickT = kickSegment.duration;
        else kickSegment = segments.find((s): s is Extract<Segment, { type: "kick" }> => s.type === "kick");
      }
      if (scene && kickSegment) {
        if (kickSegment.index !== currentKick) {
          currentKick = kickSegment.index;
          scene.setKick(kickSegment.kick, COLORS[kickSegment.kick.shooter % COLORS.length], kickSegment.script);
        }
        scene.update(kickT);
        scene.render();
        context.drawImage(scene.canvas, 0, 0, width, height);
      } else {
        context.fillStyle = "#4f9a3c";
        context.fillRect(0, 0, width, height);
      }

      const small = width < 420;
      const font = (weight: number, size: number) => `${weight} ${small ? size - 1 : size}px ${SANS}`;

      // Scoreboard: round, who is left, and how this round is going.
      const round = roundOf(segment);
      if (round !== null) {
        pill(`LƯỢT ${round} · CÒN ${aliveBefore(round)}`, 10, 10, font(800, 13), "rgba(15, 23, 42, 0.85)");
        const inRound = plan.kicks.filter((k) => k.round === round);
        const taken = kicksBefore(segment.type === "kick" ? segment.index : plan.kicks.length).filter(
          (k) => k.round === round,
        );
        // A kick counts on the board only once its verdict is final.
        const settled = taken.length + (segment.type === "kick" && local >= segment.script.finalAt ? 1 : 0);
        const scored = inRound.slice(0, settled).filter((k) => k.goal).length;
        const missed = settled - scored;
        pill(
          `✅ ${scored}  ❌ ${missed}  ⏳ ${inRound.length - settled}`,
          width - 10,
          10,
          font(700, 13),
          "rgba(15, 23, 42, 0.85)",
          "#ffffff",
          "right",
        );
      }

      if (segment.type === "kick" && scene) {
        const { kick, script } = segment;
        const shooter = plan.names[kick.shooter];
        const keeper = plan.names[kick.keeper];

        // Name tags over the two heads.
        const heads = scene.anchors();
        const shooterAt = scene.project(heads.shooter, width, height);
        const keeperAt = scene.project(heads.keeper, width, height);
        if (keeperAt) pill(`🧤 ${keeper}`, keeperAt.x, keeperAt.y - 30, font(700, 12), "rgba(236, 72, 153, 0.9)", "#ffffff", "center");
        if (shooterAt && local < script.kickAt + 300) {
          pill(`⚽ ${shooter}`, shooterAt.x, Math.min(height - 70, shooterAt.y - 28), font(700, 12), COLORS[kick.shooter % COLORS.length], "#ffffff", "center");
        }
        const fanAt = heads.fan && scene.project(heads.fan, width, height);
        if (fanAt) pill("😤 Fan cuồng", fanAt.x, fanAt.y - 30, font(800, 12), "rgba(185, 28, 28, 0.92)", "#ffffff", "center");
        if (keeperAt && kick.outcome === "sleepy") {
          context.font = `${20 + 4 * Math.sin(local / 200)}px ${EMOJI_FONT}`;
          context.textAlign = "center";
          context.fillText("💤", keeperAt.x + 30 + ((local / 30) % 20), keeperAt.y + 10 - ((local / 25) % 30));
        }
        if (keeperAt && kick.outcome === "face" && local > script.kickAt + 480) {
          context.font = `22px ${EMOJI_FONT}`;
          context.textAlign = "center";
          context.fillText("💫", keeperAt.x + Math.sin(local / 120) * 14, keeperAt.y + 12);
        }

        // Who is up against whom, while they line up.
        if (local < script.kickAt - 200) {
          const alpha = Math.min(1, local / 250);
          context.globalAlpha = alpha;
          pill(`⚽ ${shooter}  đối mặt  🧤 ${keeper}`, width / 2, height - 44, font(800, 14), "rgba(15, 23, 42, 0.88)", "#ffffff", "center");
          context.globalAlpha = 1;
        }

        // The verdict, VAR, and the commentary.
        if (script.varAt !== undefined && local >= script.varAt && local < script.finalAt) {
          dim(0.45);
          const dots = ".".repeat(1 + (Math.floor(local / 300) % 3));
          context.fillStyle = "#0f172a";
          const boxW = Math.min(width - 40, 320);
          context.beginPath();
          context.roundRect(width / 2 - boxW / 2, height / 2 - 48, boxW, 96, 14);
          context.fill();
          context.strokeStyle = "#38bdf8";
          context.lineWidth = 3;
          context.stroke();
          bigText([`📺 VAR${dots}`], height / 2 - 12, "#38bdf8", 0.8);
          context.font = font(600, 13);
          context.fillStyle = "#cbd5e1";
          context.fillText("Đang xem lại tình huống", width / 2, height / 2 + 26);
        } else if (local >= script.resolveAt) {
          const verdict = local >= script.finalAt ? script.final : script.first;
          const shownAt = local >= script.finalAt ? script.finalAt : script.resolveAt;
          const age = local - shownAt;
          const pop = age < 180 ? 0.6 + (age / 180) * 0.55 : age < 300 ? 1.15 - ((age - 180) / 120) * 0.15 : 1;
          context.font = `900 ${Math.min(40, width / 11)}px ${SANS}`;
          bigText(wrap(context, verdict.text, width - 30), height * 0.3, verdict.good ? "#4ade80" : "#f87171", pop);
          if (local >= script.finalAt) {
            context.font = font(600, 13);
            const lines = wrap(context, script.line, width - 60);
            lines.forEach((line, i) =>
              pill(line, width / 2, height - 44 - (lines.length - 1 - i) * 28, font(600, 13), "rgba(15, 23, 42, 0.88)", "#ffffff", "center"),
            );
          }
        }
      }

      if (segment.type === "intro") {
        dim(0.55 * Math.min(1, (segment.duration - local) / 400));
        bigText(["LOẠT SÚT", "LUÂN LƯU ⚽"], height * 0.36, "#ffffff", Math.min(1, local / 250));
        pill(`${plan.names.length} cầu thủ · đá hỏng là bị loại`, width / 2, height * 0.66, font(700, 14), "rgba(236, 72, 153, 0.92)", "#ffffff", "center");
      }

      if (segment.type === "rules") {
        drawRules(local, segment.duration);
      }

      if (segment.type === "break") {
        const info = plan.rounds[segment.round - 1];
        dim(0.62);
        bigText([`HẾT LƯỢT ${segment.round}`], height * 0.26, "#facc15");
        context.font = font(700, 15);
        const text = info.eliminated.length
          ? `Bị loại: ${info.eliminated.map((player) => plan.names[player]).join(", ")}`
          : "Cả lượt đá hỏng — không ai bị loại, đá lại!";
        wrap(context, text, width - 40).forEach((line, i) =>
          pill(line, width / 2, height * 0.42 + i * 32, font(700, 15), info.eliminated.length ? "rgba(220, 38, 38, 0.9)" : "rgba(37, 99, 235, 0.9)", "#ffffff", "center"),
        );
        const left = info.shooters.filter((player) => !info.eliminated.includes(player));
        context.font = font(600, 13);
        wrap(context, `Còn lại: ${left.map((player) => plan.names[player]).join(", ")}`, width - 40).forEach((line, i) =>
          pill(line, width / 2, height * 0.66 + i * 28, font(600, 13), "rgba(15, 23, 42, 0.85)", "#ffffff", "center"),
        );
      }

      if (segment.type === "finale") {
        dim(0.55);
        const champion = plan.names[plan.ranking[0]];
        bigText(["🏆", champion, "VÔ ĐỊCH!"], height * 0.26, "#facc15", Math.min(1, local / 300));
        // Confetti, from the time alone.
        for (let i = 0; i < 40; i++) {
          const x = ((i * 97) % width) + Math.sin(local / 300 + i) * 12;
          const y = ((local / (4 + (i % 5)) + i * 53) % (height + 20)) - 10;
          context.fillStyle = ["#facc15", "#ec4899", "#38bdf8", "#4ade80", "#f97316"][i % 5];
          context.fillRect(x, y, 6, 10);
        }
      }
    };

    // Filming, as the race does it.
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
        recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 2_500_000 });
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (!discarded) recordedRef.current?.(new Blob(chunks, { type }));
        };
        recorder.start(1000);
      } catch (error) {
        console.error("Could not record the shootout", error);
        recorder = null;
        recordedRef.current?.(null);
      }
    };

    const finish = (now: number) => {
      if (finished) return;
      finished = true;
      endedAt = now;
      setOver(true);
      finishRef.current();
    };

    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      const segment = segments.find((s) => timeline < s.start + s.duration) ?? segments.at(-1)!;
      if (scene) timeline = Math.min(total, timeline + dt * segment.speed * speedRef.current);
      draw(timeline);
      if (timeline >= total) {
        finish(now);
        if (recorder?.state === "recording" && now - endedAt < HOLD_MS) {
          frame = requestAnimationFrame(tick);
        } else if (recorder?.state === "recording") recorder.stop();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    skipRef.current = () => {
      timeline = total;
    };

    size();
    import("three")
      .then((THREE) => import("./penalty-scene").then(({ createPenaltyScene }) => ({ THREE, createPenaltyScene })))
      .then(({ THREE, createPenaltyScene }) => {
        if (disposed) return;
        try {
          scene = createPenaltyScene(THREE);
        } catch (error) {
          console.error("Could not build the pitch", error);
        }
        size();
        setReady(true);
        last = performance.now();
        startRecording();
      })
      .catch((error) => console.error("Could not load the pitch", error));
    frame = requestAnimationFrame(tick);

    const observer = new ResizeObserver(() => {
      size();
      if (finished) draw(total);
    });
    observer.observe(canvas);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      discarded = true;
      if (recorder?.state === "recording") recorder.stop();
      scene?.dispose();
    };
  }, [plan, record]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Đá penalty: ${plan.names.join(", ")}`}
        className="block aspect-[4/3] max-h-[480px] w-full rounded-md bg-[#4f9a3c] sm:aspect-[16/10]"
      />
      {!over && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant={fast ? "default" : "outline"} disabled={!ready} onClick={() => setFast(!fast)}>
            <FastForward className="size-4" />
            {fast ? "Tốc độ ×2.5" : "Tua nhanh"}
          </Button>
          <Button size="sm" variant="outline" disabled={!ready} onClick={() => skipRef.current()}>
            <SkipForward className="size-4" />
            Xem kết quả
          </Button>
        </div>
      )}
    </div>
  );
}
