import { SignUp } from "@clerk/nextjs";

import { AuthScreen } from "@/components/layout/auth-screen";
import { pageTitle } from "@/lib/app-name";

export const metadata = { title: pageTitle("Tạo tài khoản") };

export default function SignUpPage() {
  return (
    <AuthScreen subtitle="Tạo tài khoản bằng địa chỉ email của bạn.">
      <SignUp signInUrl="/login" />
    </AuthScreen>
  );
}
