"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetLuckyEnvelopes, setLuckyEnvelopeEnabled } from "@/app/(app)/admin/settings/actions";
import { LUCKY_ODDS } from "@/lib/lucky-envelope";

/**
 * The lì xì may mắn switch, this round's tally, and the reset. The switch only
 * shows or hides the envelope — opened ones keep their discount — so it never
 * asks. The reset wipes every envelope, and the discount on any day not yet
 * paid with them, so it asks first.
 */
export function LuckyEnvelopeSettings({
  enabled,
  opened,
  byPercent,
}: {
  enabled: boolean;
  opened: number;
  byPercent: Record<number, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function setEnabled(next: boolean) {
    startTransition(async () => {
      const result = await setLuckyEnvelopeEnabled({ enabled: next });
      if (result.ok) {
        toast.success(
          next
            ? "Đã bật lì xì — mọi người có thể mở."
            : "Đã tắt lì xì. Lì xì đã mở vẫn được giữ.",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function reset() {
    startTransition(async () => {
      const result = await resetLuckyEnvelopes();
      setConfirming(false);
      if (result.ok) {
        toast.success(`Đã đặt lại — xoá ${result.data ?? 0} lì xì, mọi người có thể mở lại.`);
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
          <span aria-hidden>🧧</span>
          Lì xì may mắn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Khi bật, mỗi người thấy một bao lì xì giữa trang Hôm nay và được mở{" "}
          <strong>một lần</strong>. Lì xì giảm giá hoá đơn của chính ngày mở — cả món, suất và phí
          ship. Tiền trả quán không đổi: phần giảm là quà của bạn.
        </p>

        <div className="flex flex-wrap gap-2">
          {LUCKY_ODDS.map((odd) => (
            <span
              key={odd.percent}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              Giảm {odd.percent}% · tỉ lệ {odd.weight}%
            </span>
          ))}
        </div>

        {(enabled || opened > 0) && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
            <p>
              Đợt này: <strong className="tabular-nums">{opened}</strong> người đã mở
            </p>
            {!enabled && (
              <p className="text-muted-foreground">
                Đang tắt — lì xì đã mở vẫn được giảm giá. Bật lại để tiếp tục đợt này.
              </p>
            )}
            {opened > 0 && (
              <p className="text-muted-foreground tabular-nums">
                {LUCKY_ODDS.map((odd) => `${byPercent[odd.percent] ?? 0} × ${odd.percent}%`).join(
                  " · ",
                )}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <Button variant="outline" disabled={isPending} onClick={() => setEnabled(false)}>
              {isPending && !confirming && <Loader2 className="size-4 animate-spin" />}
              Tắt lì xì
            </Button>
          ) : (
            <Button disabled={isPending} onClick={() => setEnabled(true)}>
              {isPending && !confirming && <Loader2 className="size-4 animate-spin" />}
              Bật lì xì
            </Button>
          )}
          {(enabled || opened > 0) && (
            <Button
              variant="outline"
              disabled={isPending || opened === 0}
              onClick={() => setConfirming(true)}
            >
              <RotateCcw className="size-4" />
              Đặt lại
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open && !isPending) setConfirming(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đặt lại lì xì?</DialogTitle>
            <DialogDescription>
              Xoá lì xì của cả {opened} người đã mở. Ngày nào chưa thanh toán sẽ{" "}
              <strong>mất phần giảm giá</strong> và trở lại giá đầy đủ; ngày đã thanh toán giữ
              nguyên số tiền đã trả.{" "}
              {enabled
                ? "Mọi người được mở lì xì mới ngay."
                : "Khi bật lại, mọi người được mở lì xì mới."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setConfirming(false)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={reset}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Đặt lại
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
