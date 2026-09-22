import { SignIn } from "@clerk/nextjs";

import { AuthScreen } from "@/components/layout/auth-screen";
import { pageTitle } from "@/lib/app-name";

export const metadata = { title: pageTitle("Đăng nhập") };

export default function LoginPage() {
  return (
    <AuthScreen>
      <SignIn signUpUrl="/sign-up" />
    </AuthScreen>
  );
}
