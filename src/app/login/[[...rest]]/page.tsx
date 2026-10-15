import { SignIn } from "@clerk/nextjs";

import { AuthScreen } from "@/components/layout/auth-screen";
import { WelcomeLinkBanner } from "@/components/welcome/welcome-link-banner";
import { getAppSettings } from "@/db/queries/settings";
import { pageTitle } from "@/lib/app-name";

// The banner follows the welcome screen's switch, read per request.
export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Đăng nhập") };

export default async function LoginPage() {
  const settings = await getAppSettings();
  const showWelcome =
    settings.welcomeEnabled && Boolean(settings.welcomeTitle || settings.welcomeMessage);

  return (
    <AuthScreen>
      {showWelcome && <WelcomeLinkBanner title={settings.welcomeTitle} />}
      <SignIn signUpUrl="/sign-up" />
    </AuthScreen>
  );
}
