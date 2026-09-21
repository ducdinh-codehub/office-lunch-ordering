import { SignIn } from "@clerk/nextjs";

import { AuthScreen } from "@/components/layout/auth-screen";

export const metadata = { title: "Đăng nhập · Lunch Time" };

export default function LoginPage() {
  return (
    <AuthScreen subtitle="Hệ thống đặt cơm trưa phòng PTPM3">
      <SignIn signUpUrl="/sign-up" />
    </AuthScreen>
  );
}
