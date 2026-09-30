"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setGymPromoEnabled } from "@/app/(app)/admin/settings/actions";

type Target = "banner" | "dialog";

const LABEL: Record<Target, string> = {
  banner: "banner Gym Time",
  dialog: "thông báo Gym Time",
};

/** The switches for the Gym Time banner on the home page and the sign-in dialog. */
export function GymPromoSettings({
  bannerEnabled,
  dialogEnabled,
}: {
  bannerEnabled: boolean;
  dialogEnabled: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="size-4" />
          Gym Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <GymPromoToggle target="banner" enabled={bannerEnabled}>
          Khi bật, banner Gym Time hiện ở đầu trang chủ của mọi người.
        </GymPromoToggle>
        <GymPromoToggle target="dialog" enabled={dialogEnabled}>
          Khi bật, mỗi người thấy hộp thoại giới thiệu Gym Time <strong>một lần</strong> sau mỗi
          lần đăng nhập.
        </GymPromoToggle>
      </CardContent>
    </Card>
  );
}

function GymPromoToggle({
  target,
  enabled,
  children,
}: {
  target: Target;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setEnabled(next: boolean) {
    startTransition(async () => {
      const result = await setGymPromoEnabled({ target, enabled: next });
      if (result.ok) {
        toast.success(next ? `Đã bật ${LABEL[target]}.` : `Đã tắt ${LABEL[target]}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground min-w-0 flex-1 basis-60 text-sm">{children}</p>
      {enabled ? (
        <Button variant="outline" disabled={isPending} onClick={() => setEnabled(false)}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Tắt {target === "banner" ? "banner" : "thông báo"}
        </Button>
      ) : (
        <Button disabled={isPending} onClick={() => setEnabled(true)}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Bật {target === "banner" ? "banner" : "thông báo"}
        </Button>
      )}
    </div>
  );
}
