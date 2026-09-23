"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withSlot, type MenuSlot } from "@/lib/menu-slot";

export type DinerOption = { id: string; name: string; email: string };

/**
 * Ordering on someone else's behalf — folded away until asked for, since most
 * visits to this page are just reading the day's list.
 *
 * The chosen person lives in the URL so the page re-renders on the server with
 * their bookings; `children` is that server-rendered booking UI, passed through
 * rather than duplicated here.
 */
export function OrderForUser({
  serviceDate,
  slot,
  users,
  selectedUserId,
  children,
}: {
  serviceDate: string;
  slot: MenuSlot;
  users: DinerOption[];
  selectedUserId: string | null;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  // A person already in the URL means the form was left open — keep it open.
  const [open, setOpen] = useState(Boolean(selectedUserId));

  function close() {
    setOpen(false);
    if (selectedUserId) router.push(withSlot(`/admin/bookings/${serviceDate}`, slot));
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Đặt hộ
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <UserPlus className="text-muted-foreground size-4" />
          <span className="text-sm font-medium">Đặt hộ</span>
          <Select
            value={selectedUserId ?? ""}
            onValueChange={(value) =>
              router.push(
                withSlot(`/admin/bookings/${serviceDate}?for=${value}`, slot),
              )
            }
          >
            <SelectTrigger size="sm" className="h-auto w-64">
              <SelectValue placeholder="Chọn người…" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <span className="flex flex-col items-start">
                    <span>{user.name}</span>
                    <span className="text-muted-foreground text-xs">{user.email}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={close}>
            <X className="size-4" />
            Đóng
          </Button>
        </div>

        {children}
      </CardContent>
    </Card>
  );
}
