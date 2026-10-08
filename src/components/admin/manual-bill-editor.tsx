"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createManualBill, deleteManualBill } from "@/app/(app)/admin/bills/actions";
import { formatServiceDate, type ServiceDate } from "@/lib/date";
import {
  formatServiceTime,
  MANUAL_BILL_ITEM_NAME_MAX,
  MANUAL_BILL_MAX_ITEMS,
  MANUAL_BILL_TITLE_MAX,
} from "@/lib/manual-bill";
import { formatVnd } from "@/lib/money";

export type BillMember = { id: string; name: string; email: string };

export type BillListRow = {
  id: string;
  name: string;
  email: string;
  serviceDate: ServiceDate;
  serviceTime: string | null;
  title: string | null;
  items: {
    name: string;
    quantity: number;
    unitPriceVnd: number;
    lineTotalVnd: number;
  }[];
  totalVnd: number;
};

type DraftLine = { key: number; name: string; quantity: string; price: string };

/** "45.000" or "45000" → 45000; anything without a digit → null. */
function parseVnd(value: string): number | null {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

let nextKey = 0;
function blankLine(): DraftLine {
  nextKey += 1;
  return { key: nextKey, name: "", quantity: "1", price: "" };
}

/**
 * Writing a bill for one person by hand: who, which date (and optionally what
 * time), and the lines with their names and prices. The total shown here is a
 * preview — the server sums the lines again before saving.
 */
export function ManualBillEditor({
  members,
  bills,
  today,
  lookbackDays,
}: {
  members: BillMember[];
  bills: BillListRow[];
  today: ServiceDate;
  lookbackDays: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [serviceDate, setServiceDate] = useState(today);
  const [serviceTime, setServiceTime] = useState("");
  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()]);

  // Two people can share a name; the email tells them apart, on the chosen
  // value as well as in the list.
  const memberItems = members.map((member) => ({
    value: member.id,
    label: `${member.name} · ${member.email}`,
    name: member.name,
    email: member.email,
  }));

  const previewVnd = lines.reduce(
    (total, line) => total + (Number(line.quantity) || 0) * (parseVnd(line.price) ?? 0),
    0,
  );

  function updateLine(key: number, change: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...change } : line)),
    );
  }

  function save() {
    const items = lines
      // A line left completely empty is just the spare row, not a mistake.
      .filter((line) => line.name.trim() || line.price.trim())
      .map((line) => ({
        name: line.name,
        quantity: Number(line.quantity),
        unitPriceVnd: parseVnd(line.price) ?? -1,
      }));
    if (items.some((item) => item.unitPriceVnd < 0)) {
      toast.error("Món nào cũng cần có giá.");
      return;
    }

    startTransition(async () => {
      const result = await createManualBill({
        userId: userId ?? "",
        serviceDate,
        serviceTime,
        title,
        items,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã ghi hoá đơn.");
      setTitle("");
      setLines([blankLine()]);
      router.refresh();
    });
  }

  function remove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      const result = await deleteManualBill({ id });
      setRemovingId(null);
      if (result.ok) {
        toast.success("Đã xoá hoá đơn.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden>🧾</span>
            Ghi hoá đơn mới
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Lì xì, sinh nhật và giảm giá riêng của ngày đó cũng trừ vào hoá đơn này. Ngày người đó
            đã thanh toán thì không ghi thêm được.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bill-member">Người trả</Label>
              <Select
                items={memberItems}
                value={userId}
                onValueChange={(value) => setUserId(value)}
                disabled={isPending}
              >
                <SelectTrigger id="bill-member" className="w-full">
                  <SelectValue placeholder="Chọn một người" />
                </SelectTrigger>
                <SelectContent>
                  {memberItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{item.name}</span>
                        <span className="text-muted-foreground truncate text-xs">{item.email}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bill-date">Ngày</Label>
              <Input
                id="bill-date"
                type="date"
                value={serviceDate}
                disabled={isPending}
                onChange={(event) => setServiceDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bill-time">Giờ (không bắt buộc)</Label>
              <Input
                id="bill-time"
                type="time"
                value={serviceTime}
                disabled={isPending}
                onChange={(event) => setServiceTime(event.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="bill-title">Tiêu đề (người đó thấy được)</Label>
              <Input
                id="bill-title"
                value={title}
                maxLength={MANUAL_BILL_TITLE_MAX}
                placeholder="Trà sữa chiều thứ 6"
                disabled={isPending}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-muted-foreground grid grid-cols-[1fr_4rem_7rem_2.25rem] gap-2 text-xs">
              <span>Món</span>
              <span>SL</span>
              <span>Đơn giá (₫)</span>
              <span />
            </div>
            {lines.map((line, index) => (
              <div key={line.key} className="grid grid-cols-[1fr_4rem_7rem_2.25rem] gap-2">
                <Input
                  aria-label={`Tên món ${index + 1}`}
                  value={line.name}
                  maxLength={MANUAL_BILL_ITEM_NAME_MAX}
                  placeholder="Trà đào"
                  disabled={isPending}
                  onChange={(event) => updateLine(line.key, { name: event.target.value })}
                />
                <Input
                  aria-label={`Số lượng món ${index + 1}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  step={1}
                  value={line.quantity}
                  disabled={isPending}
                  onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                />
                <Input
                  aria-label={`Đơn giá món ${index + 1}`}
                  inputMode="numeric"
                  value={line.price}
                  placeholder="35000"
                  disabled={isPending}
                  onChange={(event) => updateLine(line.key, { price: event.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Bỏ món ${index + 1}`}
                  disabled={isPending || lines.length === 1}
                  onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              disabled={isPending || lines.length >= MANUAL_BILL_MAX_ITEMS}
              onClick={() => setLines((current) => [...current, blankLine()])}
            >
              <Plus className="size-4" />
              Thêm món
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="text-sm">
              Tổng: <span className="font-semibold tabular-nums">{formatVnd(previewVnd)}</span>
            </span>
            <Button disabled={isPending || !userId || !serviceDate} onClick={save}>
              {isPending && removingId === null && <Loader2 className="size-4 animate-spin" />}
              Ghi hoá đơn
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đã ghi ({lookbackDays} ngày qua trở đi)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bills.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có hoá đơn nào.</p>
          ) : (
            bills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">{bill.name}</span>
                    <span className="text-muted-foreground text-xs"> · {bill.email}</span>
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatServiceDate(bill.serviceDate)}
                    {bill.serviceTime && ` · ${formatServiceTime(bill.serviceTime)}`}
                    {bill.title && ` · ${bill.title}`}
                  </p>
                  <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs">
                    {bill.items.map((item, index) => (
                      <li key={index} className="flex justify-between gap-2">
                        <span className="truncate">
                          {item.name} × {item.quantity}
                        </span>
                        <span className="tabular-nums">{formatVnd(item.lineTotalVnd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <span className="font-medium tabular-nums">{formatVnd(bill.totalVnd)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Xoá hoá đơn của ${bill.name}`}
                  disabled={isPending}
                  onClick={() => remove(bill.id)}
                >
                  {removingId === bill.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
