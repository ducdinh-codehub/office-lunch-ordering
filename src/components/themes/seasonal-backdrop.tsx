import "server-only";

import { getAppSettings } from "@/db/queries/settings";
import { parseHomeTheme, type HomeThemeId } from "@/lib/home-themes";

import { CozyWinterBackdrop } from "./cozy-winter-backdrop";
import { HalloweenBackdrop } from "./halloween-backdrop";
import { LunarNewYearBackdrop } from "./lunar-new-year-backdrop";
import { MidAutumnBackdrop } from "./mid-autumn-backdrop";

// Keyed on every id in HOME_THEMES, so a theme added there without a backdrop
// here is a type error rather than a silently empty page.
const backdrops: Record<HomeThemeId, () => React.ReactNode> = {
  "mid-autumn": MidAutumnBackdrop,
  "cozy-winter": CozyWinterBackdrop,
  halloween: HalloweenBackdrop,
  "lunar-new-year": LunarNewYearBackdrop,
};

/**
 * The theme picked in /admin/settings, drawn behind a page. Reads the setting
 * itself so a page opts in with one line: render this as the first child of
 * the page's root, and give that root `relative isolate` — the backdrop sits at
 * `-z-10` inside the stacking context `isolate` creates, which puts it below
 * the page's cards but above the shell's background.
 */
export async function SeasonalBackdrop() {
  const theme = parseHomeTheme((await getAppSettings()).homeTheme);
  if (theme === "none") return null;
  const Backdrop = backdrops[theme];
  return <Backdrop />;
}
