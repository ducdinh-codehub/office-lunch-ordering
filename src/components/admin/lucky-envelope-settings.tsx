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

/** What asks for confirmation first: both wipe every envelope opened so far. */
type Pending = "disable" | "reset" | null;

/**
 * The lì xì may mắn switch, this round's tally, and the reset. Turning it off
 * and resetting both wipe the envelopes — and with them the discount on any
 * day not yet paid — so each asks first whenever there is something to lose.
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
  const [confirming, setConfirming] = useState<Pending>(null);

  function setEnabled(next: boolean) {
    startTransition(async () => {
      const result = await setLuckyEnvelopeEnabled({ enabled: next });
      setConfirming(null);
      if (result.ok) {
        toast.success(next ? "Đã bật lì xì — mọi người có thể mở." : "Đã tắt lì xì và xoá dữ liệu.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function reset() {
    startTransition(async () => {
      const result = await resetLuckyEnvelopes();
      setConfirming(null);
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

        {enabled && (
          <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm">
            <p>
              Đợt này: <strong className="tabular-nums">{opened}</strong> người đã mở
            </p>
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
            <Button
              variant="outline"
              disabled={isPending}
              // Nothing opened yet means nothing to lose — no need to ask.
              onClick={() => (opened > 0 ? setConfirming("disable") : setEnabled(false))}
            >
              {isPending && confirming === null && <Loader2 className="size-4 animate-spin" />}
              Tắt lì xì
            </Button>
          ) : (
            <Button disabled={isPending} onClick={() => setEnabled(true)}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Bật lì xì
            </Button>
          )}
          {enabled && (
            <Button
              variant="outline"
              disabled={isPending || opened === 0}
              onClick={() => setConfirming("reset")}
            >
              <RotateCcw className="size-4" />
              Đặt lại
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming === "disable" ? "Tắt lì xì may mắn?" : "Đặt lại lì xì?"}
            </DialogTitle>
            <DialogDescription>
              Xoá lì xì của cả {opened} người đã mở. Ngày nào chưa thanh toán sẽ{" "}
              <strong>mất phần giảm giá</strong> và trở lại giá đầy đủ; ngày đã thanh toán giữ
              nguyên số tiền đã trả.{" "}
              {confirming === "disable"
                ? "Khi bật lại, mọi người được mở lì xì mới."
                : "Mọi người được mở lì xì mới ngay."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={isPending} onClick={() => setConfirming(null)}>
              Huỷ
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => (confirming === "disable" ? setEnabled(false) : reset())}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {confirming === "disable" ? "Tắt và xoá" : "Đặt lại"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
