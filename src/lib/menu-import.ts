import type { MenuItemCategory } from "@/db/schema";

export type ParsedMenuItem = {
  name: string;
  category: MenuItemCategory;
  priceVnd: number;
  description: string | null;
};

export type ParsedMenu = {
  items: ParsedMenuItem[];
  /** Paid dishes the text gave no price for — the admin has to fill these in. */
  missingPrice: number;
  /** Lines that were not a header and not inside any section. */
  skipped: string[];
};

/** Lowercase, strip diacritics, collapse spaces — so "Món Chính" matches "mon chinh". */
function normalise(line: string): string {
  return line
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTION_KEYWORDS: ReadonlyArray<[string, MenuItemCategory]> = [
  ["mon chinh", "main"],
  ["mon phu", "side"],
  ["mon rau", "veg"],
  ["goi them", "addon"],
  ["do uong", "drink"],
];

/**
 * Lines after the dishes that are not dishes: the restaurant's phone number,
 * opening hours, and the price-band blurb.
 */
const STOP_PATTERNS = [
  "lien he",
  "gio mo cua",
  "suat an",
  "nha hang bao gia",
  "dat mon",
];

/** Leading bullets and the emoji restaurants decorate every line with. */
function cleanName(line: string): string {
  return line
    .replace(/^[-•*+\s]+/, "")
    .replace(/[\p{Extended_Pictographic}️⃣]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/[:\s]+$/, "")
    .trim();
}

/**
 * Pulls a price off the end of a dish line.
 *
 * Handles the shapes these menus actually use: `25k`, `35k/100g`, `10k/ hộp`,
 * `25.000`, `25000đ`. Returns the price in whole dong plus whatever unit came
 * after the slash, which becomes the description.
 */
function extractPrice(line: string): { rest: string; priceVnd: number; unit: string | null } {
  const match = line.match(/(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|đ|d|vnd)?\s*(\/\s*\S.*)?$/i);
  if (!match || !match[1]) return { rest: line, priceVnd: 0, unit: null };

  const [, digits, suffix, slashUnit] = match;
  const numeric = Number(digits.replace(/[.,]/g, ""));
  if (!Number.isFinite(numeric) || numeric === 0) return { rest: line, priceVnd: 0, unit: null };

  // "25k" is 25.000; a bare "25.000" is already whole dong. A suffix-less number
  // under 1000 is almost certainly thousands too ("Canh Cua 10").
  const isThousands = suffix?.toLowerCase() === "k" || /nghìn|ngàn/i.test(suffix ?? "");
  const priceVnd = isThousands || numeric < 1000 ? numeric * 1000 : numeric;

  const unit = slashUnit ? cleanName(slashUnit.replace(/^\/\s*/, "")) : null;
  return {
    rest: line.slice(0, match.index).trim(),
    priceVnd,
    unit: unit || null,
  };
}

/**
 * Turns the restaurant's Zalo message into menu items.
 *
 * Section headers ("🥓🥩 Món Chính:") switch the category; every non-empty line
 * under one is a dish. Set dishes carry no price — the suất covers them — so a
 * price is only read for "Gọi thêm" and "Đồ uống".
 */
export function parseMenuText(text: string): ParsedMenu {
  const items: ParsedMenuItem[] = [];
  const skipped: string[] = [];
  let category: MenuItemCategory | null = null;
  let missingPrice = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const flat = normalise(line);
    if (STOP_PATTERNS.some((pattern) => flat.includes(pattern))) break;

    const header = SECTION_KEYWORDS.find(([keyword]) => flat.includes(keyword));
    if (header) {
      category = header[1];
      continue;
    }

    if (!category) {
      skipped.push(line);
      continue;
    }

    // Emoji come off first: a price at the end of the line is only at the end
    // once the decorative "25k 🍎" trailer is gone.
    const cleaned = cleanName(line);
    const paid = category === "addon" || category === "drink";
    const { rest, priceVnd, unit } = paid
      ? extractPrice(cleaned)
      : { rest: cleaned, priceVnd: 0, unit: null };

    const name = cleanName(rest);
    if (!name) continue;

    if (paid && priceVnd === 0) missingPrice += 1;
    items.push({ name, category, priceVnd, description: unit });
  }

  return { items, missingPrice, skipped };
}
