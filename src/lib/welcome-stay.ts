/**
 * The stay's map link on the welcome message. The admin sets the link once
 * (`app_settings.welcome_map_url`) and writes the message as usual; the value
 * of its "Lưu trú:" line — "Resort Hòa Bình" in "🏨 Lưu trú: Resort Hòa
 * Bình" — is what becomes the link. Client-safe: /welcome and the settings
 * preview both split a line here.
 */

export const WELCOME_MAP_URL_MAX = 500;

/** Up to and including the colon, then the value. */
const STAY_LINE = /^(.*?lưu trú\s*:\s*)(\S.*)$/iu;

/** The "Lưu trú:" line split before its value, or null for any other line. */
export function splitStayLine(line: string): { lead: string; value: string } | null {
  // Compared composed: the same letters can arrive as base + combining marks.
  const match = STAY_LINE.exec(line.normalize("NFC"));
  return match ? { lead: match[1], value: match[2] } : null;
}

/** Only an http(s) address is a link; anything else would not open a map. */
export function isMapUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
