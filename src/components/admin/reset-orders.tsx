"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetOrderHistory } from "@/app/(app)/admin/settings/actions";
import { RESET_CONFIRM_PHRASE } from "@/lib/admin-reset";

/**
 * Yearly reset. Two guards, because there is no undo: the button stays disabled
 * until the phrase matches, and the action checks it again server-side.
 */
export function ResetOrders({ bookingCount }: { bookingCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState("");

  const armed = confirm.trim() === RESET_CONFIRM_PHRASE;

  function handleReset() {
    if (!armed) return;
    startTransition(async () => {
      const result = await resetOrderHistory({ confirm });
      if (result.ok) {
        toast.success(`Đã xoá ${result.data ?? 0} lượt đặt món.`);
        setConfirm("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2 text-base">
          <TriangleAlert className="size-4" />
          Xoá toàn bộ dữ liệu đặt món
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-muted-foreground space-y-1 text-sm">
          <p>
            Xoá sạch lịch sử đặt món, suất đã chốt và các lần thanh toán — dùng khi bắt đầu
            một năm mới. <span className="text-foreground font-medium">Không thể hoàn tác.</span>
          </p>
          <p>
            Tài khoản của mọi người, thực đơn và cài đặt ngân hàng được giữ nguyên.
          </p>
          <p className="text-foreground">
            Hiện có <span className="font-medium tabular-nums">{bookingCount}</span> lượt đặt món.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reset-confirm">
            Gõ <span className="font-mono font-medium">{RESET_CONFIRM_PHRASE}</span> để xác nhận
          </Label>
          <Input
            id="reset-confirm"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={RESET_CONFIRM_PHRASE}
            autoComplete="off"
            className="max-w-xs"
          />
        </div>

        <Button variant="destructive" disabled={!armed || isPending} onClick={handleReset}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Xoá toàn bộ
        </Button>
      </CardContent>
    </Card>
  );
}
