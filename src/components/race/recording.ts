import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { APP_TIMEZONE } from "@/lib/date";

/**
 * Recording a race to a video the viewer keeps. The canvas is filmed with
 * `captureStream` + `MediaRecorder`, entirely in the browser: the file goes
 * straight to the device and nothing is uploaded, which keeps the race what
 * the page says it is — just for fun, with nothing saved on our side.
 */

/** MP4 first: it plays everywhere, iPhones included. WebM where MP4 cannot be recorded. */
const VIDEO_TYPES = [
  "video/mp4;codecs=avc1",
  "video/mp4",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

export function pickVideoType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return VIDEO_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

/** Whether this browser can film a canvas at all. False on the server. */
export function canRecord(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return typeof canvas.captureStream === "function" && pickVideoType() !== null;
}

/** "dua-vui-2026-09-27-1215.mp4", in Vietnam time like everything else here. */
export function videoFileName(type: string): string {
  const stamp = format(new TZDate(Date.now(), APP_TIMEZONE), "yyyy-MM-dd-HHmm");
  return `dua-vui-${stamp}.${type.startsWith("video/mp4") ? "mp4" : "webm"}`;
}
