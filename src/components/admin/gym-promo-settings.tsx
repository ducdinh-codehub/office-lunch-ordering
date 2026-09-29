"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Dumbbell, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setGymPromoEnabled } from "@/app/(app)/admin/settings/actions";

/** The switch for the Gym Time dialog each diner sees once per sign-in. */
export function GymPromoSettings({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setEnabled(next: boolean) {
    startTransition(async () => {
      const result = await setGymPromoEnabled({ enabled: next });
      if (result.ok) {
        toast.success(next ? "Đã bật thông báo Gym Time." : "Đã tắt thông báo Gym Time.");
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
          <Dumbbell className="size-4" />
          Thông báo Gym Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Khi bật, mỗi người thấy hộp thoại giới thiệu Gym Time <strong>một lần</strong> sau mỗi
          lần đăng nhập.
        </p>
        {enabled ? (
          <Button variant="outline" disabled={isPending} onClick={() => setEnabled(false)}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Tắt thông báo
          </Button>
        ) : (
          <Button disabled={isPending} onClick={() => setEnabled(true)}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Bật thông báo
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
