"use client";

import { useState, useTransition } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setBooking } from "@/app/(app)/menu/actions";
import { formatVnd } from "@/lib/money";

export type MenuItemRowProps = {
  item: {
    id: string;
    name: string;
    description: string | null;
    priceVnd: number;
    isAvailable: boolean;
  };
  quantity: number;
  canBook: boolean;
  /** Set when an admin is ordering for someone else. */
  onBehalfOf?: string;
};

export function MenuItemRow({ item, quantity, canBook, onBehalfOf }: MenuItemRowProps) {
  // Optimistic local count so tapping +/- feels instant; reconciled by revalidation.
  const [count, setCount] = useState(quantity);
  const [isPending, startTransition] = useTransition();

  function changeBy(delta: number) {
    const next = Math.max(0, Math.min(10, count + delta));
    if (next === count) return;
    const previous = count;
    setCount(next);

    startTransition(async () => {
      const result = await setBooking({
        menuItemId: item.id,
        quantity: next,
        onBehalfOf,
      });
      if (!result.ok) {
        setCount(previous);
        toast.error(result.error);
      }
    });
  }

  const disabled = !canBook || isPending || (!item.isAvailable && count === 0);

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        count > 0 ? "border-primary/40 bg-primary/5" : "bg-background"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.name}</span>
          {!item.isAvailable && (
            <Badge variant="secondary" className="text-xs">
              Hết món
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
        )}
        <p className="text-muted-foreground mt-1 text-sm tabular-nums">
          {formatVnd(item.priceVnd)}
          {count > 1 && (
            <span className="text-foreground font-medium">
              {" "}
              × {count} = {formatVnd(item.priceVnd * count)}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          onClick={() => changeBy(-1)}
          disabled={disabled || count === 0}
          aria-label={`Bớt một ${item.name}`}
        >
          <Minus className="size-4" />
        </Button>
        <span className="w-7 text-center font-medium tabular-nums" aria-live="polite">
          {isPending ? <Loader2 className="mx-auto size-4 animate-spin" /> : count}
        </span>
        <Button
          variant={count > 0 ? "default" : "outline"}
          size="icon"
          className="size-9"
          onClick={() => changeBy(1)}
          disabled={disabled || count >= 10}
          aria-label={`Thêm một ${item.name}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
