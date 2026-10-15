import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import { ScheduleDialog } from "@/components/welcome/schedule-dialog";
import { SignedInForward } from "@/components/welcome/signed-in-forward";
import { WelcomeBackdrop } from "@/components/welcome/welcome-backdrop";
import { WelcomeContentBox } from "@/components/welcome/welcome-content-box";
import { getAppSettings } from "@/db/queries/settings";
import { pageTitle } from "@/lib/app-name";
import { canManage, getCurrentUser } from "@/lib/auth/session";
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
 * from /admin/settings, who sees it as visitors would, on or off, and for
 * `?thu-moi=1`, the home banner's "Mở thư mời", which shows the invitation to
 * anyone while it is on.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ "xem-truoc"?: string; "lich-trinh"?: string; "thu-moi"?: string }>;
}) {
  const [user, settings, params] = await Promise.all([
    getCurrentUser(),
    getAppSettings(),
    searchParams,
  ]);
  const schedule = parseSchedule(settings.welcomeSchedule);
  const preview = params["xem-truoc"] === "1" && canManage(user, "settings");
  // The notice email's "Cùng xem lịch trình nào" link: shown to anyone, the
  // itinerary already open, for as long as there is one.
  const openSchedule = params["lich-trinh"] === "1" && schedule.length > 0;
  // The home banner's link: the invitation itself, for as long as it is on.
  const openLetter = params["thu-moi"] === "1" && settings.welcomeEnabled;
  const shown = preview || openSchedule || openLetter;
  if (!shown) {
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
      {/* The preview and the itinerary and invitation links are meant for signed-in eyes too. */}
      {!shown && <SignedInForward />}
      <WelcomeContentBox
        content={{
          title: settings.welcomeTitle,
          message: settings.welcomeMessage,
          mapUrl: settings.welcomeMapUrl,
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
      {/* Signed in, there is nothing to sign in to: the way out is back home —
          except in the preview, which shows what a visitor sees. */}
      {user && !preview ? (
        <LinkButton href="/" className={cn("mt-6", WELCOME_BUTTON_CLASS)}>
          <ArrowLeft className="size-4" />
          Về trang chủ
        </LinkButton>
      ) : (
        <LinkButton href="/login" className={cn("mt-6", WELCOME_BUTTON_CLASS)}>
          {WELCOME_BUTTON_LABEL}
          <ArrowRight className="size-4" />
        </LinkButton>
      )}
    </div>
  );
}
