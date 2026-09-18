import { SignIn } from "@clerk/nextjs";

import { AuthScreen } from "@/components/layout/auth-screen";

export const metadata = { title: "Đăng nhập · Lunch Time" };

export default function LoginPage() {
  return (
    <AuthScreen subtitle="Đặt cơm trưa và theo dõi số tiền bạn còn nợ.">
      <SignIn signUpUrl="/sign-up" />
    </AuthScreen>
  );
}
