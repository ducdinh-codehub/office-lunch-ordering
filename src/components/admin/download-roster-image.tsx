"use client";

import { useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RosterRowData } from "@/components/admin/payment-roster";
import type { PaymentState } from "@/db/queries/payments";
import { parseServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";

/**
 * Saves Bảng thu tiền as a PNG to post in the team chat.
 *
 * The picture is drawn on a canvas rather than screenshotted from the DOM: the
 * live table scrolls sideways, pins its first column and carries admin-only
 * buttons, none of which belong in a shared picture. Drawing it also needs no
 * library and is always light, whatever theme the admin is browsing in.
 * Emails are left out on purpose — the picture leaves the app.
 *
 * Sizes are sized for a phone: a chat app shrinks a wide picture to fit the
 * screen, so text that looks large here is what stays readable there.
 */

const SCALE = 2;
const PAD = 40;
const TABLE_PAD_X = 20;
const HEAD_H = 64;
const ROW_H = 56;
const FOOT_H = 60;
const CELL_W = 92;
const CELL_GAP = 8;
const RADIUS = 16;

const ink = "#18181b";
const muted = "#71717a";
const rule = "#e4e4e7";
const headBg = "#f4f4f5";
const stripe = "#fafafa";

const palette: Record<PaymentState, { bg: string; fg: string }> = {
  confirmed: { bg: "#d1fae5", fg: "#047857" },
  pending: { bg: "#fef3c7", fg: "#b45309" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c" },
  unpaid: { bg: "#f4f4f5", fg: "#3f3f46" },
};

const legend: { state: PaymentState; label: string }[] = [
  { state: "confirmed", label: "Đã trả" },
  { state: "pending", label: "Chờ xác nhận" },
  { state: "unpaid", label: "Chưa trả" },
  { state: "rejected", label: "Không thấy giao dịch" },
];

const thousands = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** 45000 → "45k", 47500 → "47,5k" — a full amount is too wide for a cell. */
function compactVnd(amount: number): string {
  return `${thousands.format(amount / 1000)}k`;
}

function nameOf(row: RosterRowData): string {
  return row.displayName ?? row.email.split("@")[0];
}

function drawRoster(
  rows: RosterRowData[],
  dates: string[],
  title: string,
  subtitle: string,
): HTMLCanvasElement {
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const font = (weight: number, size: number) => `${weight} ${size}px ${family}`;
  const totalLeft = rows.reduce((acc, row) => acc + row.outstandingVnd + row.pendingVnd, 0);

  // Measure first: the name and total columns are as wide as their widest text.
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font(600, 22);
  const nameW = Math.max(
    140,
    ...rows.map((row) => Math.ceil(probe.measureText(nameOf(row)).width) + 32),
  );
  probe.font = font(700, 22);
  const remainW = Math.max(150, Math.ceil(probe.measureText(formatVnd(totalLeft)).width) + 12);
  probe.font = font(700, 36);
  const titleW = Math.ceil(probe.measureText(title).width);

  const tableW = TABLE_PAD_X * 2 + nameW + 16 + dates.length * CELL_W + 16 + remainW;
  const width = Math.max(tableW, titleW, 640) + PAD * 2;
  const tableTop = PAD + 100;
  const tableH = HEAD_H + rows.length * ROW_H + FOOT_H;
  const legendTop = tableTop + tableH + 32;
  const height = legendTop + 32 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = font(700, 36);
  ctx.fillText(title, PAD, PAD + 22);
  ctx.fillStyle = muted;
  ctx.font = font(400, 22);
  ctx.fillText(subtitle, PAD, PAD + 68);

  // Table frame, clipped so the header band and stripes follow its corners.
  const tableX = PAD;
  const frameW = width - PAD * 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(tableX, tableTop, frameW, tableH, RADIUS);
  ctx.clip();

  ctx.fillStyle = headBg;
  ctx.fillRect(tableX, tableTop, frameW, HEAD_H);
  rows.forEach((_, index) => {
    if (index % 2 === 1) {
      ctx.fillStyle = stripe;
      ctx.fillRect(tableX, tableTop + HEAD_H + index * ROW_H, frameW, ROW_H);
    }
  });
  const footTop = tableTop + HEAD_H + rows.length * ROW_H;
  ctx.fillStyle = headBg;
  ctx.fillRect(tableX, footTop, frameW, FOOT_H);
  ctx.restore();

  ctx.strokeStyle = rule;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(tableX, tableTop, frameW, tableH, RADIUS);
  ctx.stroke();

  const hline = (y: number) => {
    ctx.beginPath();
    ctx.moveTo(tableX, y);
    ctx.lineTo(tableX + frameW, y);
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  for (let index = 0; index <= rows.length; index++) hline(tableTop + HEAD_H + index * ROW_H);

  const left = tableX + TABLE_PAD_X;
  const right = tableX + frameW - TABLE_PAD_X;
  const dateX = (index: number) => left + nameW + 16 + index * CELL_W;

  // Header: weekday above the date.
  const headY = tableTop + HEAD_H / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = font(700, 20);
  ctx.fillText("Người", left, headY);
  ctx.textAlign = "center";
  dates.forEach((date, index) => {
    const day = parseServiceDate(date);
    const cx = dateX(index) + CELL_W / 2;
    ctx.fillStyle = muted;
    ctx.font = font(500, 15);
    ctx.fillText(format(day, "EEEEEE", { locale: vi }), cx, headY - 11);
    ctx.fillStyle = ink;
    ctx.font = font(700, 18);
    ctx.fillText(format(day, "dd/MM"), cx, headY + 11);
  });
  ctx.textAlign = "right";
  ctx.font = font(700, 20);
  ctx.fillText("Còn lại", right, headY);

  rows.forEach((row, rowIndex) => {
    const top = tableTop + HEAD_H + rowIndex * ROW_H;
    const midY = top + ROW_H / 2;

    ctx.textAlign = "left";
    ctx.font = font(600, 22);
    ctx.fillStyle = ink;
    ctx.fillText(nameOf(row), left, midY);
    if (row.fullySettled) {
      const x = left + ctx.measureText(nameOf(row)).width + 10;
      ctx.fillStyle = palette.confirmed.fg;
      ctx.font = font(700, 20);
      ctx.fillText("✓", x, midY);
    }

    ctx.textAlign = "center";
    dates.forEach((date, index) => {
      const cell = row.cells[date];
      if (!cell) return;
      const colors = palette[cell.state];
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.roundRect(dateX(index) + CELL_GAP / 2, top + 9, CELL_W - CELL_GAP, ROW_H - 18, 10);
      ctx.fill();
      ctx.fillStyle = colors.fg;
      ctx.font = font(700, 19);
      ctx.fillText(compactVnd(cell.owedVnd), dateX(index) + CELL_W / 2, midY);
    });

    const unsettled = row.outstandingVnd + row.pendingVnd;
    ctx.textAlign = "right";
    if (unsettled > 0) {
      ctx.font = font(700, 22);
      ctx.fillStyle = palette.rejected.fg;
      ctx.fillText(formatVnd(unsettled), right, midY);
    } else {
      ctx.font = font(600, 20);
      ctx.fillStyle = palette.confirmed.fg;
      ctx.fillText("Đã đủ", right, midY);
    }
  });

  // Footer: what is still out across everyone.
  const footY = footTop + FOOT_H / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = font(700, 22);
  ctx.fillText("Tổng còn lại", left, footY);
  ctx.textAlign = "right";
  ctx.font = font(800, 24);
  ctx.fillStyle = totalLeft > 0 ? palette.rejected.fg : palette.confirmed.fg;
  ctx.fillText(formatVnd(totalLeft), right, footY);

  // Legend
  ctx.textAlign = "left";
  ctx.font = font(500, 19);
  let x = PAD;
  const legendY = legendTop + 16;
  for (const item of legend) {
    const colors = palette[item.state];
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(x, legendY - 12, 24, 24, 6);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(item.label, x + 34, legendY);
    x += 34 + ctx.measureText(item.label).width + 28;
  }

  return canvas;
}

export function DownloadRosterImage({
  rows,
  dates,
  title,
  subtitle,
  fileName,
}: {
  rows: RosterRowData[];
  dates: string[];
  title: string;
  subtitle: string;
  fileName: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      // Without this the first draw can land in the fallback font.
      await document.fonts.ready;
      const canvas = drawRoster(rows, dates, title, subtitle);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("toBlob returned null");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error(error);
      toast.error("Không tạo được ảnh bảng thu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={busy} onClick={handleDownload}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />}
      Tải ảnh
    </Button>
  );
}
