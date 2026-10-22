"use client";

import { useState } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { RosterRowData } from "@/components/admin/payment-roster";
import type { PaymentState } from "@/db/queries/payments";
import { formatServiceDateShort } from "@/lib/date";
import { formatVnd } from "@/lib/money";

/**
 * Saves Bảng thu tiền as a PNG to post in the team chat.
 *
 * The picture is drawn on a canvas rather than screenshotted from the DOM: the
 * live table scrolls sideways, pins its first column and carries admin-only
 * buttons, none of which belong in a shared picture. Drawing it also needs no
 * library and is always light, whatever theme the admin is browsing in.
 * Emails are left out on purpose — the picture leaves the app.
 */

const SCALE = 2;
const PAD = 24;
const ROW_H = 34;
const HEAD_H = 30;
const CELL_W = 64;
const CELL_GAP = 4;

const ink = "#18181b";
const muted = "#71717a";
const rule = "#e4e4e7";

const palette: Record<PaymentState, { bg: string; fg: string }> = {
  confirmed: { bg: "#d1fae5", fg: "#047857" },
  pending: { bg: "#fef3c7", fg: "#b45309" },
  rejected: { bg: "#fee2e2", fg: "#b91c1c" },
  unpaid: { bg: "#f4f4f5", fg: "#52525b" },
};

const legend: { state: PaymentState; label: string }[] = [
  { state: "confirmed", label: "đã trả" },
  { state: "pending", label: "đã báo, chưa xác nhận" },
  { state: "unpaid", label: "chưa trả" },
  { state: "rejected", label: "không thấy giao dịch" },
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

  // Measure first: the name column is as wide as the longest name.
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font(500, 14);
  const nameW = Math.max(
    80,
    ...rows.map((row) => Math.ceil(probe.measureText(nameOf(row)).width)),
  );
  probe.font = font(600, 14);
  const remainW = Math.max(
    90,
    ...rows.map((row) =>
      Math.ceil(probe.measureText(formatVnd(row.outstandingVnd + row.pendingVnd)).width),
    ),
  );

  const nameCol = nameW + 20;
  const gridW = nameCol + dates.length * CELL_W + remainW + 16;
  const width = Math.max(gridW, 420) + PAD * 2;
  const tableTop = PAD + 56;
  const legendTop = tableTop + HEAD_H + rows.length * ROW_H + 18;
  const height = legendTop + 20 + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = width * SCALE;
  canvas.height = height * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = "middle";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = ink;
  ctx.font = font(600, 20);
  ctx.fillText(title, PAD, PAD + 12);
  ctx.fillStyle = muted;
  ctx.font = font(400, 13);
  ctx.fillText(subtitle, PAD, PAD + 36);

  const left = PAD;
  const right = PAD + gridW;
  const dateX = (index: number) => left + nameCol + index * CELL_W;

  // Header
  const headY = tableTop + HEAD_H / 2;
  ctx.font = font(500, 13);
  ctx.fillStyle = ink;
  ctx.textAlign = "left";
  ctx.fillText("Người", left, headY);
  ctx.font = font(500, 11);
  ctx.fillStyle = muted;
  ctx.textAlign = "center";
  dates.forEach((date, index) => {
    ctx.fillText(formatServiceDateShort(date), dateX(index) + CELL_W / 2, headY);
  });
  ctx.font = font(500, 13);
  ctx.fillStyle = ink;
  ctx.textAlign = "right";
  ctx.fillText("Còn lại", right, headY);

  ctx.strokeStyle = rule;
  ctx.lineWidth = 1;
  const hline = (y: number) => {
    ctx.beginPath();
    ctx.moveTo(left, y + 0.5);
    ctx.lineTo(right, y + 0.5);
    ctx.stroke();
  };
  hline(tableTop + HEAD_H);

  rows.forEach((row, rowIndex) => {
    const top = tableTop + HEAD_H + rowIndex * ROW_H;
    const midY = top + ROW_H / 2;

    ctx.textAlign = "left";
    ctx.font = font(500, 14);
    ctx.fillStyle = ink;
    ctx.fillText(nameOf(row), left, midY);
    if (row.fullySettled) {
      ctx.fillStyle = palette.confirmed.fg;
      ctx.fillText("✓", left + ctx.measureText(nameOf(row)).width + 6, midY);
    }

    ctx.textAlign = "center";
    dates.forEach((date, index) => {
      const cell = row.cells[date];
      const cx = dateX(index) + CELL_W / 2;
      if (!cell) {
        ctx.fillStyle = "#d4d4d8";
        ctx.font = font(400, 12);
        ctx.fillText("·", cx, midY);
        return;
      }
      const colors = palette[cell.state];
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.roundRect(dateX(index) + CELL_GAP / 2, top + 5, CELL_W - CELL_GAP, ROW_H - 10, 4);
      ctx.fill();
      ctx.fillStyle = colors.fg;
      ctx.font = font(500, 12);
      ctx.fillText(compactVnd(cell.owedVnd), cx, midY);
    });

    const unsettled = row.outstandingVnd + row.pendingVnd;
    ctx.textAlign = "right";
    if (unsettled > 0) {
      ctx.font = font(600, 14);
      ctx.fillStyle = ink;
      ctx.fillText(formatVnd(unsettled), right, midY);
    } else {
      ctx.font = font(400, 14);
      ctx.fillStyle = muted;
      ctx.fillText("—", right, midY);
    }

    if (rowIndex < rows.length - 1) hline(top + ROW_H);
  });

  // Legend
  ctx.textAlign = "left";
  ctx.font = font(400, 12);
  let x = left;
  const legendY = legendTop + 10;
  for (const item of legend) {
    const colors = palette[item.state];
    ctx.fillStyle = colors.bg;
    ctx.beginPath();
    ctx.roundRect(x, legendY - 8, 16, 16, 3);
    ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(item.label, x + 22, legendY);
    x += 22 + ctx.measureText(item.label).width + 16;
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
