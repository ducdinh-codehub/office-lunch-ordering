"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { markPaidByAdmin, unmarkPaid } from "@/app/(app)/admin/payments/actions";
import { formatServiceDateShort } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { PaymentState } from "@/db/queries/payments";

/** Serialisable shape — `Map` can't cross the server/client boundary. */
export type RosterRowData = {
  userId: string;
  displayName: string | null;
  email: string;
  cells: Record<string, { owedVnd: number; state: PaymentState }>;
  totalOwedVnd: number;
  outstandingVnd: number;
  pendingVnd: number;
  confirmedVnd: number;
  fullySettled: boolean;
};

const cellStyle: Record<PaymentState | "none", string> = {
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  rejected: "bg-destructive/15 text-destructive",
  unpaid: "bg-muted text-muted-foreground",
  none: "",
};

const stateLabel: Record<PaymentState, string> = {
  confirmed: "đã trả",
  pending: "chờ xác nhận",
  rejected: "không tìm thấy",
  unpaid: "chưa trả",
};

const cellMark: Record<PaymentState, string> = {
  confirmed: "✓",
  pending: "…",
  rejected: "✕",
  unpaid: "—",
};

export function PaymentRoster({
  rows,
  dates,
}: {
  rows: RosterRowData[];
  dates: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  function settleAll(row: RosterRowData) {
    const unsettled = dates.filter((date) => {
      const cell = row.cells[date];
      return cell && cell.state !== "confirmed";
    });
    if (unsettled.length === 0) return;

    setActiveUserId(row.userId);
    startTransition(async () => {
      const result = await markPaidByAdmin({ userId: row.userId, serviceDates: unsettled });
      if (result.ok) {
        toast.success(`Đã đánh dấu ${row.displayName ?? row.email} trả đủ.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveUserId(null);
    });
  }

  function undoAll(row: RosterRowData) {
    const settled = dates.filter((date) => row.cells[date]?.state === "confirmed");
    if (settled.length === 0) return;

    setActiveUserId(row.userId);
    startTransition(async () => {
      const result = await unmarkPaid({ userId: row.userId, serviceDates: settled });
      if (result.ok) {
        toast.success("Đã đặt lại thành chưa trả.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setActiveUserId(null);
    });
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center">
          <p className="text-3xl" aria-hidden>
            📋
          </p>
          <p className="mt-3 font-medium">Không có ai đặt món trong khoảng này.</p>
        </CardContent>
      </Card>
    );
  }

  const settledCount = rows.filter((row) => row.fullySettled).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Ai đã trả</CardTitle>
          <Badge variant={settledCount === rows.length ? "default" : "secondary"}>
            {settledCount}/{rows.length} đã trả đủ
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* The grid is wide by nature — it scrolls inside its own box so the page never does. */}
        <div className="-mx-3 overflow-x-auto px-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="bg-background sticky left-0 z-10 py-2 pr-3 text-left font-medium">
                  Người
                </th>
                {dates.map((date) => (
                  <th
                    key={date}
                    className="text-muted-foreground px-1.5 py-2 text-center text-xs font-medium whitespace-nowrap"
                  >
                    {formatServiceDateShort(date)}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  Còn lại
                </th>
                <th className="py-2 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = isPending && activeUserId === row.userId;
                const unsettled = row.outstandingVnd + row.pendingVnd;
                return (
                  <tr key={row.userId} className="border-b last:border-0">
                    <td className="bg-background sticky left-0 z-10 py-2 pr-3">
                      <span className="font-medium whitespace-nowrap">
                        {row.displayName ?? row.email.split("@")[0]}
                      </span>
                      {row.fullySettled && (
                        <Check className="ml-1.5 inline size-3.5 text-emerald-600" />
                      )}
                    </td>

                    {dates.map((date) => {
                      const cell = row.cells[date];
                      return (
                        <td key={date} className="px-1 py-1.5 text-center">
                          {cell ? (
                            <span
                              title={`${formatVnd(cell.owedVnd)} · ${stateLabel[cell.state]}`}
                              className={`inline-flex h-7 min-w-9 items-center justify-center rounded px-1.5 text-xs font-medium ${cellStyle[cell.state]}`}
                            >
                              {cellMark[cell.state]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">·</span>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2 text-right tabular-nums">
                      {unsettled > 0 ? (
                        <span className="font-medium">{formatVnd(unsettled)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-2 text-right">
                      {row.fullySettled ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          disabled={isPending}
                          onClick={() => undoAll(row)}
                          title="Đặt lại những ngày này thành chưa trả"
                        >
                          <Undo2 className="size-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => settleAll(row)}
                        >
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Đánh dấu đã trả
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-muted-foreground mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span>
            <span className={`mr-1 inline-block rounded px-1 ${cellStyle.confirmed}`}>✓</span>
            đã trả
          </span>
          <span>
            <span className={`mr-1 inline-block rounded px-1 ${cellStyle.pending}`}>…</span>
            đã báo, chưa xác nhận
          </span>
          <span>
            <span className={`mr-1 inline-block rounded px-1 ${cellStyle.unpaid}`}>—</span>
            chưa trả
          </span>
          <span>
            <span className={`mr-1 inline-block rounded px-1 ${cellStyle.rejected}`}>✕</span>
            không thấy giao dịch
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
