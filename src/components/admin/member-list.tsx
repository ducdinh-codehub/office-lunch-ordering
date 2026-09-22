"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { renameMember } from "@/app/(app)/admin/settings/actions";
import { DISPLAY_NAME_MAX } from "@/lib/display-name";

export type MemberRow = {
  id: string;
  displayName: string;
  /** Shown in place of a name when they have not set one. */
  fallbackName: string;
  email: string;
  photoUrl: string | null;
  isAdmin: boolean;
};

/**
 * Renaming people from the admin side — for the colleague who never set a name
 * and shows up on the kitchen list as an email prefix.
 *
 * Each row saves on its own, like the dish editor, so a long list needs no
 * all-or-nothing submit.
 */
export function MemberList({ members }: { members: MemberRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Thành viên{" "}
          <span className="text-muted-foreground font-normal">({members.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Đổi tên hiển thị của mọi người. Mỗi người cũng tự đổi được ở trang Hồ sơ của họ —
          ai lưu sau thì tên đó được dùng.
        </p>
        {members.map((member) => (
          <MemberRowEditor key={member.id} member={member} />
        ))}
        {members.length === 0 && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Chưa có ai đăng nhập vào app.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRowEditor({ member }: { member: MemberRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(member.displayName);

  const trimmed = name.trim();
  const isDirty = trimmed !== member.displayName.trim();

  function handleSave() {
    startTransition(async () => {
      const result = await renameMember({ userId: member.id, displayName: name });
      if (result.ok) {
        toast.success(
          trimmed
            ? `Đã đổi tên thành ${trimmed}.`
            : `Đã dùng lại tên mặc định (${member.fallbackName}).`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photoUrl}
          alt=""
          className="size-8 shrink-0 rounded-full"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span
          aria-hidden
          className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium"
        >
          {(trimmed || member.fallbackName).slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-[10rem] flex-1">
        <Input
          value={name}
          maxLength={DISPLAY_NAME_MAX}
          placeholder={member.fallbackName}
          aria-label={`Tên hiển thị của ${member.email}`}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground max-w-[14rem] truncate text-xs">
          {member.email}
        </span>
        {member.isAdmin && (
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="size-3" />
            Quản lý
          </Badge>
        )}
        <Button
          size="sm"
          variant={isDirty ? "default" : "ghost"}
          disabled={isPending || !isDirty}
          onClick={handleSave}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Lưu
        </Button>
      </div>
    </div>
  );
}
