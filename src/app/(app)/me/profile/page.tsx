import { ProfileForm } from "@/components/me/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hồ sơ</h1>
        <p className="text-muted-foreground text-sm">
          Tên bạn đặt ở đây là tên cả nhóm nhìn thấy trong danh sách đặt món và bảng thu.
        </p>
      </div>

      <ProfileForm
        displayName={user.displayName ?? ""}
        // What the group sees when no name is set, matching every other list.
        fallbackName={user.email.split("@")[0]}
        email={user.email}
        photoUrl={user.photoUrl}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">Email đăng nhập</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <p className="text-muted-foreground text-xs">
            Email và mật khẩu do tài khoản đăng nhập quản lý, không đổi được ở đây.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
