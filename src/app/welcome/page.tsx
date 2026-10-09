import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import { ScheduleDialog } from "@/components/welcome/schedule-dialog";
import { WelcomeBackdrop } from "@/components/welcome/welcome-backdrop";
import { WelcomeContentBox } from "@/components/welcome/welcome-content-box";
import { getAppSettings } from "@/db/queries/settings";
import { pageTitle } from "@/lib/app-name";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { parseSchedule } from "@/lib/welcome-schedule";
import {
  parseWelcomeBorderStyle,
  parseWelcomeTheme,
  WELCOME_BUTTON_CLASS,
  WELCOME_BUTTON_LABEL,
  WELCOME_GROUND_THEMES,
  welcomeImageUrl,
} from "@/lib/welcome-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Chào mừng") };

/**
 * The screen a signed-out visitor meets before /login, when the admin has
 * turned it on at /admin/settings. Off, it forwards straight to /login — which
 * is why sign-out can always land here. Signed in, there is nothing to welcome
 * anyone to: it forwards home — except for an admin opening `?xem-truoc=1`
 * from /admin/settings, who sees it as visitors would, on or off.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ "xem-truoc"?: string; "lich-trinh"?: string }>;
}) {
  const [user, settings, params] = await Promise.all([
    getCurrentUser(),
    getAppSettings(),
    searchParams,
  ]);
  const schedule = parseSchedule(settings.welcomeSchedule);
  const preview = params["xem-truoc"] === "1" && user?.isAdmin === true;
  // The notice email's "Cùng xem lịch trình nào" link: shown to anyone, the
  // itinerary already open, for as long as there is one.
  const openSchedule = params["lich-trinh"] === "1" && schedule.length > 0;
  if (!preview && !openSchedule) {
    if (user) redirect("/");
    if (!settings.welcomeEnabled) redirect("/login");
  }

  const theme = parseWelcomeTheme(settings.welcomeTheme);

  return (
    <div
      className={cn(
        "relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10 sm:p-6",
        // Centre in the space above the people on the ground, not the whole screen.
        WELCOME_GROUND_THEMES.includes(theme) && "pb-36 sm:pb-[23vh]",
      )}
    >
      <WelcomeBackdrop theme={theme} />
      <WelcomeContentBox
        content={{
          title: settings.welcomeTitle,
          message: settings.welcomeMessage,
          imageUrl: settings.welcomeImageId ? welcomeImageUrl(settings.welcomeImageId) : null,
          textScale: settings.welcomeTextScale,
          imageScale: settings.welcomeImageScale,
          borderStyle: parseWelcomeBorderStyle(settings.welcomeBorderStyle),
          borderWidth: settings.welcomeBorderWidth,
          borderColor: settings.welcomeBorderColor,
          borderRadius: settings.welcomeBorderRadius,
        }}
        footer={
          schedule.length > 0 && (
            <ScheduleDialog
              days={schedule}
              defaultOpen={openSchedule}
              // A link, not a button: the one button on the screen is sign-in.
              triggerClassName="text-primary mt-1 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium underline decoration-current/40 underline-offset-4 hover:decoration-current"
            />
          )
        }
      />
      <LinkButton href="/login" className={cn("mt-6", WELCOME_BUTTON_CLASS)}>
        {WELCOME_BUTTON_LABEL}
        <ArrowRight className="size-4" />
      </LinkButton>
    </div>
  );
}
