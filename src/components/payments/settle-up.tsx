"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, QrCode, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimPayment, withdrawClaim } from "@/app/(app)/me/payments/actions";
import { formatServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { DayLedgerEntry, PaymentState } from "@/db/queries/payments";

type BankInfo = {
  bankCode: string;
  bankAccountNo: string;
  bankAccountName: string;
  qrTemplate: string;
} | null;

const stateLabel: Record<PaymentState, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  unpaid: { label: "Chưa trả", variant: "outline" },
  pending: { label: "Chờ xác nhận", variant: "secondary" },
  confirmed: { label: "Đã trả", variant: "default" },
  rejected: { label: "Không tìm thấy — vui lòng kiểm tra lại", variant: "destructive" },
};

export function SettleUp({
  ledger,
  bank,
  memoBase,
  qrUrlBase,
  uploadedQrUrl,
  bankAccountName,
}: {
  ledger: DayLedgerEntry[];
  bank: BankInfo;
  memoBase: string;
  qrUrlBase: string | null;
  /** The admin's own QR photo, used only when VietQR is unavailable. */
  uploadedQrUrl: string | null;
  bankAccountName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  const settleable = useMemo(
    () => ledger.filter((e) => e.owedVnd > 0 && (e.state === "unpaid" || e.state === "rejected")),
    [ledger],
  );

  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(settleable.map((e) => e.serviceDate)),
  );

  const selectedEntries = settleable.filter((e) => selected.has(e.serviceDate));
  const selectedTotal = selectedEntries.reduce((total, e) => total + e.owedVnd, 0);

  const qrUrl = useMemo(() => {
    if (!qrUrlBase || selectedTotal <= 0) return null;
    const url = new URL(qrUrlBase);
    url.searchParams.set("amount", String(selectedTotal));
    url.searchParams.set("addInfo", memoBase);
    return url.toString();
  }, [qrUrlBase, selectedTotal, memoBase]);

  function toggle(serviceDate: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(serviceDate)) next.delete(serviceDate);
      else next.add(serviceDate);
      return next;
    });
  }

  function handleClaim() {
    if (selectedEntries.length === 0) return;
    startTransition(async () => {
      const result = await claimPayment({
        serviceDates: selectedEntries.map((e) => e.serviceDate),
        note,
      });
      if (result.ok) {
        toast.success("Đã gửi! Chúng tôi sẽ xác nhận sớm.");
        setNote("");
        // Re-select whatever is still unpaid, so the next claim starts from a
        // sensible default instead of an empty selection.
        setSelected(
          new Set(
            settleable
              .filter((e) => !selected.has(e.serviceDate))
              .map((e) => e.serviceDate),
          ),
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleWithdraw(claimId: string) {
    startTransition(async () => {
      const result = await withdrawClaim({ claimId });
      if (result.ok) {
        toast.success("Đã thu hồi yêu cầu.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const pendingClaimIds = [
    ...new Set(
      ledger.filter((e) => e.state === "pending" && e.claimId).map((e) => e.claimId as string),
    ),
  ];

  if (ledger.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center">
          <p className="text-3xl" aria-hidden>
            🧾
          </p>
          <p className="mt-3 font-medium">Không có gì để thanh toán.</p>
          <p className="mt-1 text-sm">Đặt một bữa trưa rồi nó sẽ hiện ở đây.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {settleable.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chọn ngày bạn muốn trả</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {settleable.map((entry) => (
              <label
                key={entry.serviceDate}
                className="hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
              >
                <Checkbox
                  checked={selected.has(entry.serviceDate)}
                  onCheckedChange={() => toggle(entry.serviceDate)}
                />
                <span className="flex-1 text-sm">{formatServiceDate(entry.serviceDate)}</span>
                {entry.luckyPercent !== null && (
                  <Badge variant="outline" className="border-red-200 text-xs text-red-700">
                    🧧 −{entry.luckyPercent}%
                  </Badge>
                )}
                {entry.state === "rejected" && (
                  <Badge variant="destructive" className="text-xs">
                    Kiểm tra lại
                  </Badge>
                )}
                <span className="font-medium tabular-nums">{formatVnd(entry.owedVnd)}</span>
              </label>
            ))}

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground text-sm">
                Đã chọn {selectedEntries.length} ngày
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {formatVnd(selectedTotal)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedTotal > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4" />
              Quét mã để chuyển khoản
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {qrUrl && bank ? (
              <>
                <div className="flex justify-center">
                  {/* Plain <img>: VietQR serves a pre-rendered PNG, nothing to optimise. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrUrl}
                    alt={`Mã VietQR cho ${formatVnd(selectedTotal)}`}
                    className="w-full max-w-[280px] rounded-lg border"
                    width={280}
                    height={360}
                  />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Ngân hàng</dt>
                  <dd className="font-medium">{bank.bankCode}</dd>
                  <dt className="text-muted-foreground">Số tài khoản</dt>
                  <dd className="font-medium tabular-nums">{bank.bankAccountNo}</dd>
                  <dt className="text-muted-foreground">Chủ tài khoản</dt>
                  <dd className="font-medium">{bank.bankAccountName}</dd>
                  <dt className="text-muted-foreground">Số tiền</dt>
                  <dd className="font-medium tabular-nums">{formatVnd(selectedTotal)}</dd>
                  <dt className="text-muted-foreground">Nội dung</dt>
                  <dd className="font-mono text-xs">{memoBase}</dd>
                </dl>
              </>
            ) : uploadedQrUrl ? (
              <>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadedQrUrl}
                    alt="Mã QR ngân hàng"
                    className="w-full max-w-[280px] rounded-lg border"
                  />
                </div>
                {/* A photographed QR has no amount in it, so the numbers have to be
                    read off the page and typed in by hand. Say so loudly. */}
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Mã này không kèm sẵn số tiền — bạn tự nhập nhé.
                  </p>
                  <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-amber-900/90 dark:text-amber-200/90">
                    <dt>Số tiền</dt>
                    <dd className="font-medium tabular-nums">{formatVnd(selectedTotal)}</dd>
                    <dt>Nội dung</dt>
                    <dd className="font-mono text-xs">{memoBase}</dd>
                    {bankAccountName && (
                      <>
                        <dt>Chủ tài khoản</dt>
                        <dd className="font-medium">{bankAccountName}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground bg-muted rounded-md px-3 py-2 text-sm">
                Chưa có tài khoản ngân hàng nào. Hãy nhờ người quản lý thêm vào trong mục
                Cài đặt.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="payment-note">Ghi chú (không bắt buộc)</Label>
              <Input
                id="payment-note"
                value={note}
                placeholder="ví dụ: đã chuyển từ Momo"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <Button
              onClick={handleClaim}
              disabled={isPending || selectedEntries.length === 0}
              className="w-full"
              size="lg"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Tôi đã chuyển {formatVnd(selectedTotal)}
            </Button>
            <p className="text-muted-foreground text-center text-xs">
              Người quản lý sẽ xác nhận khi tiền về tài khoản.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lịch sử</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ledger.map((entry) => {
            const meta = stateLabel[entry.state];
            return (
              <div
                key={entry.serviceDate}
                className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span className="flex-1">{formatServiceDate(entry.serviceDate)}</span>
                <Badge variant={meta.variant} className="text-xs">
                  {meta.label}
                </Badge>
                <span className="font-medium tabular-nums">{formatVnd(entry.owedVnd)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {pendingClaimIds.length > 0 && (
        <div className="text-center">
          {pendingClaimIds.map((claimId) => (
            <Button
              key={claimId}
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => handleWithdraw(claimId)}
            >
              <Undo2 className="size-4" />
              Thu hồi yêu cầu đang chờ
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
