import { SignUp } from "@clerk/nextjs";

import { AuthScreen } from "@/components/layout/auth-screen";

export const metadata = { title: "Tạo tài khoản · Lunch Time" };

export default function SignUpPage() {
  return (
    <AuthScreen subtitle="Tạo tài khoản bằng địa chỉ email của bạn.">
      <SignUp signInUrl="/login" />
    </AuthScreen>
  );
}
