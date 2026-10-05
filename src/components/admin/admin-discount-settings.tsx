"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
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
import { removeAdminDiscount, setAdminDiscount } from "@/app/(app)/admin/settings/actions";
import { ADMIN_DISCOUNT_MAX_DAYS, ADMIN_DISCOUNT_NOTE_MAX } from "@/lib/admin-discount";
import { formatServiceDate, formatServiceDateShort, type ServiceDate } from "@/lib/date";
import { MAX_DISCOUNT_PERCENT } from "@/lib/day-discount";

export type DiscountMember = { id: string; name: string };

export type DiscountListRow = {
  id: string;
  name: string;
  serviceDate: ServiceDate;
  percent: number;
  note: string | null;
};

/**
 * Giving one person a percentage off one day or a range of days. It stacks
 * with the lì xì and the birthday, and comes off the whole day — food, suất
 * and ship. The list below shows what is still to come, so a mistake can be
 * taken back before anyone pays.
 */
export function AdminDiscountSettings({
  members,
  discounts,
  today,
}: {
  members: DiscountMember[];
  discounts: DiscountListRow[];
  today: ServiceDate;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [percent, setPercent] = useState("10");
  const [note, setNote] = useState("");

  const memberItems = members.map((member) => ({ value: member.id, label: member.name }));

  function save() {
    startTransition(async () => {
      const result = await setAdminDiscount({
        userId: userId ?? "",
        from,
        // An empty "to" means a single day.
        to: to || from,
        percent: Number(percent),
        note,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { saved = 0, skipped = [] } = result.data ?? {};
      toast.success(
        skipped.length > 0
          ? `Đã giảm giá ${saved} ngày. Bỏ qua ${skipped.length} ngày đã thanh toán: ${skipped
              .map(formatServiceDateShort)
              .join(", ")}.`
          : `Đã giảm giá ${saved} ngày.`,
      );
      setNote("");
      router.refresh();
    });
  }

  function remove(id: string) {
    setRemovingId(id);
    startTransition(async () => {
      const result = await removeAdminDiscount({ id });
      setRemovingId(null);
      if (result.ok) {
        toast.success("Đã xoá giảm giá.");
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
          <span aria-hidden>🎁</span>
          Giảm giá riêng
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Giảm giá cho một người vào một ngày hoặc nhiều ngày liền nhau (tối đa{" "}
          {ADMIN_DISCOUNT_MAX_DAYS} ngày). Cộng thêm với lì xì và sinh nhật, trừ vào cả hoá đơn của
          ngày đó. Ngày người đó đã thanh toán sẽ được bỏ qua. Tiền trả quán không đổi.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="discount-member">Người được giảm</Label>
            <Select
              items={memberItems}
              value={userId}
              onValueChange={(value) => setUserId(value)}
              disabled={isPending}
            >
              <SelectTrigger id="discount-member" className="w-full">
                <SelectValue placeholder="Chọn một người" />
              </SelectTrigger>
              <SelectContent>
                {memberItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discount-from">Từ ngày</Label>
            <Input
              id="discount-from"
              type="date"
              value={from}
              disabled={isPending}
              onChange={(event) => {
                setFrom(event.target.value);
                // Keep the range the right way round as the start moves.
                if (to < event.target.value) setTo(event.target.value);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-to">Đến ngày</Label>
            <Input
              id="discount-to"
              type="date"
              value={to}
              min={from}
              disabled={isPending}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discount-percent">Giảm (%)</Label>
            <Input
              id="discount-percent"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_DISCOUNT_PERCENT}
              step={1}
              value={percent}
              disabled={isPending}
              onChange={(event) => setPercent(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-note">Ghi chú (người đó thấy được)</Label>
            <Input
              id="discount-note"
              value={note}
              maxLength={ADMIN_DISCOUNT_NOTE_MAX}
              placeholder="Thưởng tháng 9"
              disabled={isPending}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <Button disabled={isPending || !userId || !from} onClick={save}>
          {isPending && removingId === null && <Loader2 className="size-4 animate-spin" />}
          Giảm giá
        </Button>

        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Từ hôm nay trở đi</p>
          {discounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">Chưa có giảm giá nào.</p>
          ) : (
            discounts.map((discount) => (
              <div
                key={discount.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{discount.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {formatServiceDate(discount.serviceDate)}
                    {discount.note && ` · ${discount.note}`}
                  </p>
                </div>
                <span className="font-medium tabular-nums">−{discount.percent}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Xoá giảm giá của ${discount.name}`}
                  disabled={isPending}
                  onClick={() => remove(discount.id)}
                >
                  {removingId === discount.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <X className="size-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
