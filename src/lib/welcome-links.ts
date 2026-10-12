/**
 * Links in the welcome message. The admin writes plain text, so a web address
 * pasted into a line is what makes a link — no markup to learn. A Google Maps
 * address reads as "📍 Xem bản đồ" rather than its long URL.
 *
 * Only http(s) is matched, so nothing else (a `javascript:` URL) can become a
 * link. Client-safe: /welcome, the settings preview and the email picture all
 * split a line here.
 */

export type MessagePart = { text: string } | { url: string; label: string; map: boolean };

const URL_PATTERN = /https?:\/\/[^\s]+/g;
/** Punctuation that ends a sentence rather than belonging to the address. */
const TRAILING = /[.,;:!?)\]}"'»]+$/;

const MAP_HOSTS = /^(maps\.app\.goo\.gl|goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/;

export const MAP_LINK_LABEL = "📍 Xem bản đồ";

function isMapUrl(url: URL): boolean {
  if (!MAP_HOSTS.test(url.hostname)) return false;
  // goo.gl and google.* carry much more than maps; only their maps paths count.
  if (url.hostname === "goo.gl" || url.hostname.match(/^(www\.)?google\./)) {
    return url.pathname.startsWith("/maps");
  }
  return true;
}

/** Splits one line of the message into text and links, in order. */
export function splitLinks(line: string): MessagePart[] {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(TRAILING, "");
    const start = match.index;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    if (start > last) parts.push({ text: line.slice(last, start) });
    const map = isMapUrl(url);
    parts.push({ url: url.href, label: map ? MAP_LINK_LABEL : raw, map });
    last = start + raw.length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}
