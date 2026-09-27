"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BirthdayPicker, completeBirthday, type BirthdayDraft } from "@/components/birthday-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setOwnBirthday } from "@/app/(app)/me/profile/actions";
import { BIRTHDAY_PERCENT, formatBirthday, type Birthday } from "@/lib/birthday";

/**
 * The diner's birthday: picked once, then shown read-only. It takes money off
 * a bill, so a second change goes through the admin — the server enforces
 * that too; this card only stops offering the choice.
 */
export function BirthdayCard({ birthday }: { birthday: Birthday | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<BirthdayDraft>({ month: null, day: null });
  const picked = completeBirthday(draft);

  function handleSave() {
    if (!picked) return;
    startTransition(async () => {
      const result = await setOwnBirthday({ birthday: picked });
      if (result.ok) {
        toast.success(`Đã lưu ngày sinh ${formatBirthday(picked)}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>🎂</span>
          Sinh nhật
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Đúng ngày sinh nhật, hoá đơn hôm đó của bạn được giảm {BIRTHDAY_PERCENT}% — cả món, suất
          và phí ship. Cộng dồn với lì xì nếu bạn mở trúng.
        </p>

        {birthday ? (
          <div className="space-y-1">
            <p>
              Ngày sinh của bạn: <strong className="tabular-nums">{formatBirthday(birthday)}</strong>
            </p>
            <p className="text-muted-foreground text-xs">
              Nếu bị nhầm, nhờ quản lý sửa giúp.
            </p>
          </div>
        ) : (
          <>
            <BirthdayPicker
              value={draft}
              onChange={setDraft}
              disabled={isPending}
              label="Ngày sinh của bạn"
            />
            <p className="text-muted-foreground text-xs">
              Chỉ lưu được <strong>một lần</strong>, không cần năm sinh. Sau đó muốn sửa thì nhờ
              quản lý.
            </p>
            <Button onClick={handleSave} disabled={isPending || !picked}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Lưu ngày sinh
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
