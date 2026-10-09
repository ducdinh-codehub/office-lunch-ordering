import type { CSSProperties } from "react";

/**
 * The welcome screen a signed-out visitor sees before Clerk's sign-in — set up
 * at /admin/settings and stored in the `welcome_*` columns of `app_settings`.
 *
 * Client-safe on purpose: the settings form validates and previews with the
 * same limits and the same `welcomeBoxStyle()` the real page renders with.
 */

/**
 * The backdrops behind it. To add one: add an entry here, then map its id in
 * `src/components/welcome/welcome-backdrop.tsx` — the compiler insists on the
 * second step. No migration: the column is plain text.
 */
export const WELCOME_THEMES = [
  {
    id: "default",
    label: "Mặc định",
    description: "Đồ ăn thức uống trôi nhẹ — như màn hình đăng nhập.",
    preview: "🍽️",
  },
  {
    id: "travel",
    label: "Du lịch",
    description:
      "Tranh du lịch lúc hoàng hôn: núi xa, vịnh đá vôi, thuyền buồm, máy bay và hàng dừa.",
    preview: "✈️",
  },
  {
    id: "team-building",
    label: "Team building",
    description:
      "Buổi dã ngoại chiều tà: cả đội vui chơi, lều trại, lửa trại và kéo co.",
    preview: "🎉",
  },
  {
    id: "halloween",
    label: "Halloween",
    description: "Trăng cam, dơi bay, ma bay lượn và bí ngô phát sáng.",
    preview: "🎃",
  },
] as const;

export type WelcomeThemeId = (typeof WELCOME_THEMES)[number]["id"];

/**
 * Themes with people standing along the bottom. The welcome page keeps its
 * content above them, so the card and button never sit on their heads.
 */
export const WELCOME_GROUND_THEMES: readonly WelcomeThemeId[] = ["travel", "team-building"];

export const WELCOME_THEME_IDS = WELCOME_THEMES.map((theme) => theme.id) as [
  WelcomeThemeId,
  ...WelcomeThemeId[],
];

/** Reads the stored column, treating an id the code no longer knows as the default. */
export function parseWelcomeTheme(value: string | null | undefined): WelcomeThemeId {
  return WELCOME_THEMES.some((theme) => theme.id === value) ? (value as WelcomeThemeId) : "default";
}

export const WELCOME_BORDER_STYLES = [
  { id: "none", label: "Không viền" },
  { id: "solid", label: "Liền" },
  { id: "dashed", label: "Gạch" },
  { id: "dotted", label: "Chấm" },
  { id: "double", label: "Đôi" },
] as const;

export type WelcomeBorderStyle = (typeof WELCOME_BORDER_STYLES)[number]["id"];

export const WELCOME_BORDER_STYLE_IDS = WELCOME_BORDER_STYLES.map((style) => style.id) as [
  WelcomeBorderStyle,
  ...WelcomeBorderStyle[],
];

export function parseWelcomeBorderStyle(value: string | null | undefined): WelcomeBorderStyle {
  return WELCOME_BORDER_STYLES.some((style) => style.id === value)
    ? (value as WelcomeBorderStyle)
    : "none";
}

/** Limits shared by the form and its action. */
export const WELCOME_TITLE_MAX = 120;
/** Room for a whole invitation letter, not just a greeting. */
export const WELCOME_MESSAGE_MAX = 2000;
/** Percent of the base size. */
export const WELCOME_SCALE_MIN = 50;
export const WELCOME_SCALE_MAX = 200;
/** Pixels. */
export const WELCOME_BORDER_WIDTH_MAX = 16;
export const WELCOME_BORDER_RADIUS_MAX = 48;
/** `#rrggbb`, or "" for the theme's own primary colour. */
export const WELCOME_COLOR_PATTERN = /^(#[0-9a-fA-F]{6})?$/;

/** Everything the page and the preview need to draw the centre content. */
export type WelcomeContent = {
  title: string;
  message: string;
  imageUrl: string | null;
  textScale: number;
  imageScale: number;
  borderStyle: WelcomeBorderStyle;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
};

/**
 * The frame around the content. No border still keeps the rounded panel. The
 * border is see-through like the panel behind it — mixed with transparent
 * rather than given `opacity`, which would fade the text inside too.
 */
export function welcomeBoxStyle(content: WelcomeContent): CSSProperties {
  return {
    borderStyle: content.borderStyle,
    borderWidth: content.borderStyle === "none" ? 0 : content.borderWidth,
    borderColor: `color-mix(in srgb, ${content.borderColor || "var(--primary)"} 55%, transparent)`,
    borderRadius: content.borderRadius,
  };
}

/**
 * The sign-in button under the panel: a frosted-glass pill to match it, whose
 * fill and edge are see-through while the label stays solid. Shared by
 * /welcome and the preview.
 */
export const WELCOME_BUTTON_CLASS =
  "h-11 gap-2 rounded-full border border-white/70 bg-white/45 px-6 text-base font-medium text-foreground shadow-[0_6px_24px_rgb(0_0_0/0.10)] backdrop-blur-md hover:bg-white/65 dark:border-white/15 dark:bg-slate-900/45 dark:hover:bg-slate-900/65";

/** What the button says. */
export const WELCOME_BUTTON_LABEL = "Đặt cơm trưa thôi";

/** Where a welcome picture is served — public, unlike other uploaded pictures. */
export function welcomeImageUrl(imageId: string): string {
  return `/api/welcome-image/${imageId}`;
}
