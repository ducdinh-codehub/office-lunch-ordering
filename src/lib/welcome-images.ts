/**
 * Draws the welcome screen's invitation and itinerary as pictures, for pasting
 * into a notice email — an inbox shows neither the page's glass nor its
 * dialog, but a picture travels anywhere.
 *
 * Drawn on a canvas in the browser rather than on the server: the canvas uses
 * the page's own font and the system's colour emoji, so Vietnamese and 🚌
 * come out exactly as on screen, with nothing to install. Layout runs once to
 * measure and collects the drawing as steps, which then run on a canvas of
 * the measured height. Browser-only.
 */

import type { ScheduleDay, ScheduleStop } from "@/lib/welcome-schedule";

/** Twice an email's 600px column, so it stays sharp on a phone. */
const W = 1200;
const INK = "#1c1917";
const MUTED = "#78716c";

type Ctx = CanvasRenderingContext2D;
type Step = { z: number; draw: (ctx: Ctx) => void };
type Run = { text: string; bold?: boolean };
type Placed = { text: string; bold: boolean; x: number };

const BULLET = /^\s*[•\-*·]\s/u;

const DAY_COLORS = [
  { pill: "#f59e0b", bubble: "#fef3c7", chip: "#fef3c7", chipInk: "#78350f" },
  { pill: "#0284c7", bubble: "#e0f2fe", chip: "#e0f2fe", chipInk: "#0c4a6e" },
  { pill: "#059669", bubble: "#d1fae5", chip: "#d1fae5", chipInk: "#064e3b" },
];

function fontFamily(): string {
  const page = getComputedStyle(document.documentElement).fontFamily || "system-ui";
  return `${page}, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
}

/** Collects steps while measuring with a scratch canvas. */
class Plan {
  steps: Step[] = [];
  ctx: Ctx;
  family = fontFamily();

  constructor() {
    this.ctx = document.createElement("canvas").getContext("2d")!;
  }

  font(size: number, bold = false) {
    return `${bold ? 600 : 400} ${size}px ${this.family}`;
  }

  add(z: number, draw: (ctx: Ctx) => void) {
    this.steps.push({ z, draw });
  }

  /**
   * Wraps runs of plain and bold text to `width`. The first line may start
   * further in (after a chip); `hang` indents the lines after the first.
   */
  wrap(runs: Run[], size: number, width: number, first = 0, hang = 0): Placed[][] {
    const lines: Placed[][] = [[]];
    let x = first;
    for (const run of runs) {
      this.ctx.font = this.font(size, run.bold);
      for (const token of run.text.split(/(\s+)/)) {
        if (!token) continue;
        const space = /^\s+$/.test(token);
        const line = lines[lines.length - 1];
        if (space) {
          if (line.length > 0) x += this.ctx.measureText(" ").width;
          continue;
        }
        const w = this.ctx.measureText(token).width;
        if (x + w > width && line.length > 0) {
          lines.push([]);
          x = hang;
        }
        lines[lines.length - 1].push({ text: token, bold: !!run.bold, x });
        x += w;
      }
    }
    return lines;
  }

  lineWidth(line: Placed[], size: number) {
    const last = line[line.length - 1];
    if (!last) return 0;
    this.ctx.font = this.font(size, last.bold);
    return last.x + this.ctx.measureText(last.text).width;
  }

  /** Queues the wrapped text; returns the height it takes. */
  text(
    lines: Placed[][],
    left: number,
    top: number,
    size: number,
    lineHeight: number,
    color: string,
    align: "left" | "center" = "left",
    width = 0,
  ) {
    const step = size * lineHeight;
    lines.forEach((line, i) => {
      const offset = align === "center" ? (width - this.lineWidth(line, size)) / 2 : 0;
      const y = top + i * step + step / 2;
      this.add(5, (ctx) => {
        ctx.fillStyle = color;
        ctx.textBaseline = "middle";
        for (const word of line) {
          ctx.font = this.font(size, word.bold);
          ctx.fillText(word.text, left + offset + word.x, y);
        }
      });
    });
    return lines.length * step;
  }

  async render(height: number): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = Math.ceil(height);
    const ctx = canvas.getContext("2d")!;
    for (const { draw } of [...this.steps].sort((a, b) => a.z - b.z)) {
      ctx.save();
      draw(ctx);
      ctx.restore();
    }
    // JPEG, not PNG: soft gradients make a PNG about three times larger (1 MB
    // for the itinerary), and a recipient downloads every picture before it
    // shows. Not WebP either — some mail apps will not display it. Nothing
    // here is transparent, so JPEG loses nothing.
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!jpeg) throw new Error("Không vẽ được ảnh.");
    return jpeg;
  }
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The welcome screen's golden-hour sky, with a sun, soft shapes and clouds. */
function sky(plan: Plan, height: number, sunY: number) {
  plan.add(0, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#eef1f1");
    gradient.addColorStop(0.5, "#f6efe4");
    gradient.addColorStop(1, "#f4dcc2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, height);

    ctx.fillStyle = "rgba(242, 220, 198, 0.6)";
    ctx.beginPath();
    ctx.ellipse(70, 260, 190, 150, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(216, 226, 212, 0.55)";
    ctx.beginPath();
    ctx.ellipse(W - 60, height * 0.45, 200, 160, 0.6, 0, Math.PI * 2);
    ctx.fill();

    const sun = ctx.createRadialGradient(250, sunY, 10, 250, sunY, 190);
    sun.addColorStop(0, "rgba(255, 244, 228, 1)");
    sun.addColorStop(0.45, "rgba(246, 207, 164, 0.95)");
    sun.addColorStop(0.55, "rgba(246, 207, 164, 0.35)");
    sun.addColorStop(1, "rgba(246, 207, 164, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(40, sunY - 200, 420, 400);

    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    for (const [x, y, w] of [
      [140, 70, 260],
      [820, 110, 200],
      [560, 40, 150],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, w / 12, 0, 0, Math.PI * 2);
      ctx.ellipse(x - w / 6, y - w / 22, w / 5, w / 11, 0, 0, Math.PI * 2);
      ctx.ellipse(x + w / 7, y - w / 18, w / 4, w / 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Two rolling hills along the bottom, and big flat leaves in the corners. */
function ground(plan: Plan, height: number) {
  plan.add(1, (ctx) => {
    const top = height - 230;
    ctx.fillStyle = "#c7d1bd";
    ctx.beginPath();
    ctx.moveTo(0, top + 60);
    ctx.bezierCurveTo(300, top - 10, 600, top + 50, 900, top + 30);
    ctx.bezierCurveTo(1050, top + 20, 1150, top, W, top + 20);
    ctx.lineTo(W, height);
    ctx.lineTo(0, height);
    ctx.fill();
    ctx.fillStyle = "#a7b89c";
    ctx.beginPath();
    ctx.moveTo(0, top + 140);
    ctx.bezierCurveTo(400, top + 100, 800, top + 130, W, top + 105);
    ctx.lineTo(W, height);
    ctx.lineTo(0, height);
    ctx.fill();

    const leaves = (baseX: number, flip: number) => {
      const colors = ["#5f8a6e", "#7fa58a", "#4d7560"];
      [
        [-38, 190, 0],
        [-14, 240, 1],
        [10, 220, 2],
        [34, 170, 0],
        [-2, 150, 2],
      ].forEach(([angle, length, color]) => {
        ctx.save();
        ctx.translate(baseX, height + 6);
        ctx.rotate((flip * angle * Math.PI) / 180);
        ctx.fillStyle = colors[color];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-34, -length * 0.35, -30, -length * 0.8, 0, -length);
        ctx.bezierCurveTo(30, -length * 0.8, 34, -length * 0.35, 0, 0);
        ctx.fill();
        ctx.restore();
      });
    };
    leaves(30, 1);
    leaves(W - 30, -1);
  });
}

function messageRuns(line: string): Run[] {
  return [{ text: line.trim() }];
}

/** The invitation card on the golden-hour scene, as on /welcome. */
export async function drawInvitation(title: string, message: string): Promise<Blob> {
  await document.fonts.ready;
  const plan = new Plan();
  const cardX = 90;
  const cardW = W - cardX * 2;
  const pad = 72;
  const inner = cardW - pad * 2;
  const top = 120;

  let y = top + pad;
  if (title) {
    const lines = plan.wrap([{ text: title, bold: true }], 54, inner);
    y += plan.text(lines, cardX + pad, y, 54, 1.25, INK, "center", inner) + 36;
  }

  plan.ctx.font = plan.font(30);
  const bulletIndent = plan.ctx.measureText("• ").width;
  for (const line of message.split("\n")) {
    if (line.trim() === "") {
      y += 22;
      continue;
    }
    const hang = BULLET.test(line) ? bulletIndent : 0;
    const lines = plan.wrap(messageRuns(line), 30, inner, 0, hang);
    y += plan.text(lines, cardX + pad, y, 30, 1.6, INK);
  }
  const cardH = y + pad - top;
  const height = top + cardH + 300;

  sky(plan, height, height - 250);
  ground(plan, height);
  plan.add(3, (ctx) => {
    ctx.shadowColor = "rgba(0, 0, 0, 0.10)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    roundRect(ctx, cardX, top, cardW, cardH, 44);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  return plan.render(height);
}

/** The itinerary, every day one after another, as in the "Xem lịch trình" dialog. */
export async function drawSchedule(days: ScheduleDay[]): Promise<Blob> {
  await document.fonts.ready;
  const plan = new Plan();
  const cardX = 60;
  const cardW = W - cardX * 2;
  const pad = 64;
  const left = cardX + pad;
  const right = cardX + cardW - pad;
  const lineX = left + 38;
  const contentX = left + 112;
  const contentW = right - contentX;
  const top = 70;

  // The header: a warm band across the top of the card.
  let y = top + 56;
  const titleLines = plan.wrap([{ text: "🎒 Lịch trình đi quẩy", bold: true }], 56, cardW - pad * 2);
  y += plan.text(titleLines, left, y, 56, 1.2, INK) + 10;
  const subLines = plan.wrap([{ text: "Lưu lại để không lỡ chuyến xe nào nhé!" }], 28, cardW - pad * 2);
  y += plan.text(subLines, left, y, 28, 1.4, MUTED) + 48;
  const headerBottom = y;
  y += 48;

  days.forEach((day, d) => {
    const color = DAY_COLORS[d % DAY_COLORS.length];

    // The day's pill, then its route.
    plan.ctx.font = plan.font(30, true);
    const pillW = plan.ctx.measureText(day.title).width + 56;
    const pillY = y;
    plan.add(4, (ctx) => {
      ctx.fillStyle = color.pill;
      roundRect(ctx, left, pillY, pillW, 60, 30);
      ctx.fill();
    });
    plan.text(plan.wrap([{ text: day.title, bold: true }], 30, pillW), left + 28, pillY, 30, 2, "#ffffff");
    y += 60 + 22;
    if (day.subtitle) {
      const lines = plan.wrap([{ text: day.subtitle.toUpperCase(), bold: true }], 24, cardW - pad * 2);
      y += plan.text(lines, left, y, 24, 1.4, MUTED) + 30;
    } else {
      y += 10;
    }

    const centres: number[] = [];
    day.stops.forEach((stop: ScheduleStop) => {
      const stopTop = y;
      const party = stop.emoji === "🎉";
      centres.push(stopTop + 38);

      // A time chip, the label beside it (or under it, if it will not fit).
      let rowEnd = stopTop;
      let labelStart = 0;
      if (stop.time) {
        plan.ctx.font = plan.font(24, true);
        const chipW = plan.ctx.measureText(stop.time).width + 32;
        const chipY = stopTop + 14;
        const time = stop.time;
        plan.add(4, (ctx) => {
          ctx.fillStyle = color.chip;
          roundRect(ctx, contentX, chipY, chipW, 46, 23);
          ctx.fill();
          ctx.fillStyle = color.chipInk;
          ctx.font = plan.font(24, true);
          ctx.textBaseline = "middle";
          ctx.fillText(time, contentX + 16, chipY + 24);
        });
        labelStart = chipW + 18;
        rowEnd = chipY + 46;
      }
      if (stop.label) {
        const lines = plan.wrap([{ text: stop.label, bold: true }], 30, contentW, labelStart, 0);
        rowEnd = Math.max(rowEnd, stopTop + 14 + plan.text(lines, contentX, stopTop + 14, 30, 1.5, INK));
      }
      y = Math.max(rowEnd, stopTop + 14) + 14;

      if (stop.text) {
        const lines = plan.wrap([{ text: stop.text }], 28, contentW);
        y += plan.text(lines, contentX, y, 28, 1.55, INK) + 8;
      }

      for (const detail of stop.details) {
        const runs: Run[] = detail.label
          ? [{ text: `${detail.label}:`, bold: true }, { text: ` ${detail.text}` }]
          : [{ text: detail.text }];
        const lines = plan.wrap(runs, 26, contentW - 48);
        const boxTop = y + 8;
        const boxH = lines.length * 26 * 1.55 + 32;
        plan.add(4, (ctx) => {
          ctx.fillStyle = party ? "rgba(255, 255, 255, 0.75)" : "#f5f5f4";
          roundRect(ctx, contentX, boxTop, contentW, boxH, 20);
          ctx.fill();
        });
        plan.text(lines, contentX + 24, boxTop + 16, 26, 1.55, INK);
        y = boxTop + boxH + 4;
      }
      const stopBottom = Math.max(y, stopTop + 76);

      if (party) {
        plan.add(3, (ctx) => {
          const glow = ctx.createLinearGradient(contentX, stopTop, right, stopBottom);
          glow.addColorStop(0, "#fdf4ff");
          glow.addColorStop(1, "#fffbeb");
          ctx.fillStyle = glow;
          roundRect(ctx, contentX - 20, stopTop, contentW + 40, stopBottom - stopTop + 16, 28);
          ctx.fill();
        });
      }
      plan.add(6, (ctx) => {
        const cy = stopTop + 38;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(lineX, cy, 46, 0, Math.PI * 2);
        ctx.fill();
        if (party) {
          const fill = ctx.createLinearGradient(lineX - 38, cy - 38, lineX + 38, cy + 38);
          fill.addColorStop(0, "#f5d0fe");
          fill.addColorStop(1, "#fde68a");
          ctx.fillStyle = fill;
        } else {
          ctx.fillStyle = color.bubble;
        }
        ctx.beginPath();
        ctx.arc(lineX, cy, 38, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = `38px ${plan.family}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(stop.emoji, lineX, cy + 2);
      });
      y = stopBottom + 40;
    });

    // The line that joins the day's stops.
    const first = centres[0];
    const last = centres[centres.length - 1];
    plan.add(2, (ctx) => {
      ctx.strokeStyle = "#e7e5e4";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(lineX, first);
      ctx.lineTo(lineX, last);
      ctx.stroke();
    });
    y += 30;
  });

  const footer = plan.wrap([{ text: "Hẹn gặp cả nhà! 🚌🌿", bold: true }], 30, cardW - pad * 2);
  y += plan.text(footer, left, y, 30, 1.4, MUTED, "center", cardW - pad * 2);
  const cardBottom = y + 56;
  const height = cardBottom + 70;

  plan.add(0, (ctx) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#eef1f1");
    gradient.addColorStop(1, "#f4dcc2");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, height);
  });
  plan.add(1, (ctx) => {
    ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
    ctx.shadowBlur = 50;
    ctx.shadowOffsetY = 14;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, cardX, top, cardW, cardBottom - top, 44);
    ctx.fill();
    ctx.shadowColor = "transparent";
    // The warm header band, clipped to the card's rounded top.
    ctx.save();
    roundRect(ctx, cardX, top, cardW, cardBottom - top, 44);
    ctx.clip();
    const band = ctx.createLinearGradient(cardX, top, cardX + cardW, headerBottom);
    band.addColorStop(0, "#fef3c7");
    band.addColorStop(0.5, "#fff7ed");
    band.addColorStop(1, "#ffe4e6");
    ctx.fillStyle = band;
    ctx.fillRect(cardX, top, cardW, headerBottom - top);
    ctx.restore();
  });

  return plan.render(height);
}
