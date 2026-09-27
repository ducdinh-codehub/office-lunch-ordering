"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { BirthdayPicker, completeBirthday, type BirthdayDraft } from "@/components/birthday-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { renameMember, setMemberBirthday } from "@/app/(app)/admin/settings/actions";
import { formatBirthday, type Birthday } from "@/lib/birthday";
import { DISPLAY_NAME_MAX } from "@/lib/display-name";

export type MemberRow = {
  id: string;
  displayName: string;
  /** Shown in place of a name when they have not set one. */
  fallbackName: string;
  email: string;
  photoUrl: string | null;
  isAdmin: boolean;
  birthday: Birthday | null;
};

/**
 * Renaming people from the admin side — for the colleague who never set a name
 * and shows up on the kitchen list as an email prefix — and fixing birthdays,
 * which a diner can only set once themselves.
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
          ai lưu sau thì tên đó được dùng. Ngày sinh thì mỗi người chỉ tự lưu được một lần; sửa
          hoặc xoá ở đây.
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

const sameBirthday = (a: Birthday | null, b: Birthday | null) =>
  a?.month === b?.month && a?.day === b?.day;

function MemberRowEditor({ member }: { member: MemberRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(member.displayName);
  const [birthday, setBirthday] = useState<BirthdayDraft>({
    month: member.birthday?.month ?? null,
    day: member.birthday?.day ?? null,
  });

  const trimmed = name.trim();
  const nameDirty = trimmed !== member.displayName.trim();
  const cleared = birthday.month === null && birthday.day === null;
  const picked = completeBirthday(birthday);
  // Half a birthday is neither a date nor a clear: it cannot be saved.
  const birthdayValid = cleared || picked !== null;
  const birthdayDirty = birthdayValid && !sameBirthday(picked, member.birthday);

  function handleSave() {
    startTransition(async () => {
      if (nameDirty) {
        const result = await renameMember({ userId: member.id, displayName: name });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          trimmed
            ? `Đã đổi tên thành ${trimmed}.`
            : `Đã dùng lại tên mặc định (${member.fallbackName}).`,
        );
      }
      if (birthdayDirty) {
        const result = await setMemberBirthday({ userId: member.id, birthday: picked });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(
          picked
            ? `Đã lưu ngày sinh ${formatBirthday(picked)} cho ${trimmed || member.fallbackName}.`
            : `Đã xoá ngày sinh của ${trimmed || member.fallbackName}.`,
        );
      }
      router.refresh();
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

      <div className="flex items-center gap-1">
        <span aria-hidden className="text-sm">
          🎂
        </span>
        <BirthdayPicker
          value={birthday}
          onChange={setBirthday}
          disabled={isPending}
          label={`Ngày sinh của ${member.email}`}
        />
        {!cleared && (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={isPending}
            aria-label={`Xoá ngày sinh của ${member.email}`}
            onClick={() => setBirthday({ month: null, day: null })}
          >
            <X className="size-4" />
          </Button>
        )}
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
          variant={nameDirty || birthdayDirty ? "default" : "ghost"}
          disabled={isPending || !(nameDirty || birthdayDirty) || !birthdayValid}
          onClick={handleSave}
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Lưu
        </Button>
      </div>
    </div>
  );
}
