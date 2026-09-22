"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDisplayName } from "@/app/(app)/me/profile/actions";

export function ProfileForm({
  displayName,
  fallbackName,
  email,
  photoUrl,
}: {
  displayName: string;
  fallbackName: string;
  email: string;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(displayName);

  const trimmed = name.trim();
  const isDirty = trimmed !== displayName.trim();
  // Exactly what the rest of the app will show once this is saved.
  const preview = trimmed || fallbackName;

  function handleSave() {
    startTransition(async () => {
      const result = await updateDisplayName({ displayName: name });
      if (result.ok) {
        toast.success(trimmed ? "Đã đổi tên hiển thị." : "Đã dùng lại tên mặc định.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tên hiển thị</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt=""
              className="size-11 shrink-0 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span
              aria-hidden
              className="bg-muted text-muted-foreground flex size-11 shrink-0 items-center justify-center rounded-full text-base font-medium"
            >
              {preview.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium">{preview}</p>
            <p className="text-muted-foreground truncate text-xs">{email}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="display-name">Tên bạn muốn mọi người thấy</Label>
          <Input
            id="display-name"
            value={name}
            maxLength={60}
            placeholder={fallbackName}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Để trống thì quay lại tên mặc định ({fallbackName}).
          </p>
        </div>

        <Button onClick={handleSave} disabled={isPending || !isDirty}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Lưu tên
        </Button>
      </CardContent>
    </Card>
  );
}
