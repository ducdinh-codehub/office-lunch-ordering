/**
 * The seasonal themes an admin can switch on behind the diner pages — Hôm nay,
 * Đơn của tôi, Thanh toán (wherever <SeasonalBackdrop /> is drawn) — picked in
 * /admin/settings and stored in `app_settings.home_theme`.
 *
 * To add one: add an entry here, then map its id to a backdrop component in
 * `src/components/themes/seasonal-backdrop.tsx` — the compiler insists on
 * the second step. No migration: the column is plain text.
 *
 * Client-safe on purpose; the settings picker renders this list.
 */
export const HOME_THEMES = [
  {
    id: "mid-autumn",
    label: "Tết Trung Thu",
    description: "Trăng rằm, đèn lồng bay, đèn ông sao và bánh trung thu.",
    preview: "🥮",
  },
  {
    id: "cozy-winter",
    label: "Đông ấm áp",
    description:
      "Tông xanh băng giá: gió mùa đông bắc thổi lá bay, đèn dây lấp lánh, cacao nóng và món ăn.",
    preview: "☕",
  },
  {
    id: "halloween",
    label: "Halloween",
    description: "Trăng tím, dơi bay, ma bay lượn, nhện giăng tơ và bí ngô phát sáng.",
    preview: "🎃",
  },
  {
    id: "lunar-new-year",
    label: "Tết Nguyên Đán",
    description: "Đèn lồng đỏ, hoa mai hoa đào rơi, pháo hoa, lì xì và bánh chưng.",
    preview: "🧧",
  },
] as const;

export type HomeThemeId = (typeof HOME_THEMES)[number]["id"];
export type HomeThemeSetting = HomeThemeId | "none";

export const HOME_THEME_SETTINGS = ["none", ...HOME_THEMES.map((theme) => theme.id)] as [
  HomeThemeSetting,
  ...HomeThemeSetting[],
];

/** Reads the stored column, treating an id the code no longer knows as off. */
export function parseHomeTheme(value: string | null | undefined): HomeThemeSetting {
  return HOME_THEMES.some((theme) => theme.id === value) ? (value as HomeThemeId) : "none";
}

/** The emoji that fronts the home-page wish: the theme's own, else a generic one. */
export function greetingIcon(theme: HomeThemeSetting): string {
  return HOME_THEMES.find((entry) => entry.id === theme)?.preview ?? "🎉";
}
