"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { removeEmailBanner, setEmailBanner } from "@/app/(app)/admin/settings/actions";

type Slot = "header" | "billing" | "footer";

const SLOTS: Array<{ slot: Slot; label: string; hint: string }> = [
  { slot: "header", label: "Banner đầu email", hint: "Ở đầu mọi email." },
  {
    slot: "billing",
    label: "Banner đầu email nhắc nợ",
    hint: "Thay banner đầu trong email nhắc nợ. Để trống thì dùng banner đầu email.",
  },
  { slot: "footer", label: "Banner cuối email", hint: "Ở cuối mọi email." },
];

/**
 * The pictures that frame every email. Uploaded here and kept in the
 * database: they are this deployment's branding, not part of the code.
 */
export function EmailBannerSettings({ ids }: { ids: Record<Slot, string | null> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="size-4" />
          Banner email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-muted-foreground text-sm">
          Ảnh ngang, nên rộng 1200 px (ví dụ 1200 × 300). Chưa có banner thì email gửi không có
          ảnh.
        </p>
        {SLOTS.map((item) => (
          <BannerSlot key={item.slot} {...item} imageId={ids[item.slot]} />
        ))}
      </CardContent>
    </Card>
  );
}

function BannerSlot({
  slot,
  label,
  hint,
  imageId,
}: {
  slot: Slot;
  label: string;
  hint: string;
  imageId: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function upload(file: File) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("slot", slot);
      formData.append("file", file);
      const result = await setEmailBanner(formData);
      if (result.ok) {
        toast.success(`Đã lưu ${label.toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeEmailBanner({ slot });
      if (result.ok) {
        toast.success(`Đã gỡ ${label.toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      {imageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- an admin-only upload, served as-is
        <img
          src={`/api/email-images/${imageId}`}
          alt={label}
          className="w-full max-w-xl rounded-lg border"
        />
      ) : (
        <p className="text-muted-foreground max-w-xl rounded-lg border border-dashed p-4 text-center text-sm">
          Chưa có banner
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) upload(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => input.current?.click()}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {imageId ? "Đổi ảnh" : "Tải lên"}
        </Button>
        {imageId && (
          <Button variant="ghost" size="sm" disabled={isPending} onClick={remove}>
            <Trash2 className="size-4" />
            Gỡ
          </Button>
        )}
      </div>
    </div>
  );
}
