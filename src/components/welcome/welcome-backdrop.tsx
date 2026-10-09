import { FoodBackdrop } from "@/components/layout/food-backdrop";
import { HalloweenBackdrop } from "@/components/themes/halloween-backdrop";
import { TeamBuildingBackdrop } from "@/components/themes/team-building-backdrop";
import { TravelBackdrop } from "@/components/themes/travel-backdrop";
import type { WelcomeThemeId } from "@/lib/welcome-screen";

// Keyed on every id in WELCOME_THEMES, so a theme added there without a
// backdrop here is a type error rather than a silently empty screen.
const backdrops: Record<WelcomeThemeId, () => React.ReactNode> = {
  default: FoodBackdrop,
  travel: TravelBackdrop,
  "team-building": TeamBuildingBackdrop,
  halloween: HalloweenBackdrop,
};

/** The welcome screen's backdrop, fixed behind it at `-z-10`. */
export function WelcomeBackdrop({ theme }: { theme: WelcomeThemeId }) {
  const Backdrop = backdrops[theme];
  return <Backdrop />;
}
