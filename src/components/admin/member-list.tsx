"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";

import { BirthdayPicker, completeBirthday, type BirthdayDraft } from "@/components/birthday-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  renameMember,
  setMemberAdminSections,
  setMemberBirthday,
} from "@/app/(app)/admin/settings/actions";
import { ADMIN_SECTIONS, ADMIN_SECTION_INFO, type AdminSection } from "@/lib/admin-sections";
import { formatBirthday, type Birthday } from "@/lib/birthday";
import { DISPLAY_NAME_MAX } from "@/lib/display-name";

export type MemberRow = {
  id: string;
  displayName: string;
  /** Shown in place of a name when they have not set one. */
  fallbackName: string;
  email: string;
  photoUrl: string | null;
  /** A full admin (ADMIN_EMAILS): every section, not editable here. */
  isAdmin: boolean;
  sections: AdminSection[];
  birthday: Birthday | null;
};

/**
 * Renaming people from the admin side — for the colleague who never set a name
 * and shows up on the kitchen list as an email prefix — and fixing birthdays,
 * which a diner can only set once themselves.
 *
 * Each row saves on its own, like the dish editor, so a long list needs no
 * all-or-nothing submit. A full admin also sees which parts of /admin each
 * person may manage, and toggles them there.
 */
export function MemberList({
  members,
  canEditSections,
}: {
  members: MemberRow[];
  /** Only a full admin may hand out sections — never someone holding Cài đặt. */
  canEditSections: boolean;
}) {
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
          {canEditSections &&
            " Bấm vào quyền dưới mỗi người để giao hoặc thu lại một phần trang quản lý."}
        </p>
        {members.map((member) => (
          <MemberRowEditor key={member.id} member={member} canEditSections={canEditSections} />
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

function MemberRowEditor({
  member,
  canEditSections,
}: {
  member: MemberRow;
  canEditSections: boolean;
}) {
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
    <div className="space-y-2 rounded-lg border p-2.5">
      <div className="flex flex-wrap items-center gap-2">
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
              Quản lý chính
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
      {!member.isAdmin && (canEditSections || member.sections.length > 0) && (
        <SectionToggles member={member} editable={canEditSections} />
      )}
    </div>
  );
}

/**
 * The parts of /admin this person may manage. Each tap saves at once; the tick
 * is optimistic and re-seeds from the server value whenever that moves.
 */
function SectionToggles({ member, editable }: { member: MemberRow; editable: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sections, setSections] = useState(member.sections);
  const [seed, setSeed] = useState(member.sections);
  if (seed !== member.sections) {
    setSeed(member.sections);
    setSections(member.sections);
  }

  const name = member.displayName.trim() || member.fallbackName;

  function toggle(section: AdminSection) {
    const next = sections.includes(section)
      ? sections.filter((held) => held !== section)
      : ADMIN_SECTIONS.filter((known) => known === section || sections.includes(known));
    setSections(next);
    startTransition(async () => {
      const result = await setMemberAdminSections({ userId: member.id, sections: next });
      if (!result.ok) {
        setSections(member.sections);
        toast.error(result.error);
        return;
      }
      const label = ADMIN_SECTION_INFO[section].label;
      toast.success(
        next.includes(section)
          ? `${name} giờ quản lý được ${label}.`
          : `Đã thu lại quyền ${label} của ${name}.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:pl-10">
      <span className="text-muted-foreground text-xs">Quyền quản lý:</span>
      {(editable ? ADMIN_SECTIONS : sections).map((section) => {
        const held = sections.includes(section);
        const info = ADMIN_SECTION_INFO[section];
        return editable ? (
          <Button
            key={section}
            size="xs"
            variant={held ? "default" : "outline"}
            disabled={isPending}
            aria-pressed={held}
            title={info.description}
            onClick={() => toggle(section)}
          >
            {held && <Check className="size-3" />}
            {info.label}
          </Button>
        ) : (
          <Badge key={section} variant="secondary">
            {info.label}
          </Badge>
        );
      })}
    </div>
  );
}
