"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteMenuDay } from "@/app/(app)/admin/menu/actions";
import { SLOT_LABEL, type MenuSlot } from "@/lib/menu-slot";

/**
 * Removes an afternoon menu added by mistake.
 *
 * Two taps rather than a modal: the first arms it, the second does it. Anything
 * already booked is refused server-side, so the worst this can throw away is an
 * empty menu.
 */
export function DeleteMenuDay({
  serviceDate,
  slot,
}: {
  serviceDate: string;
  slot: MenuSlot;
}) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteMenuDay({ serviceDate, slot });
      if (result.ok) {
        toast.success(`Đã xoá ${SLOT_LABEL[slot].toLowerCase()}.`);
        router.push(`/admin/menu?date=${serviceDate}`);
      } else {
        toast.error(result.error);
        setArmed(false);
      }
    });
  }

  return (
    <Button
      variant={armed ? "destructive" : "outline"}
      size="sm"
      disabled={isPending}
      onClick={handleClick}
      onBlur={() => setArmed(false)}
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      {armed ? "Chạm lần nữa để xoá" : `Xoá ${SLOT_LABEL[slot].toLowerCase()}`}
    </Button>
  );
}
