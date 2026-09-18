"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleSetDish } from "@/app/(app)/menu/actions";

export type SetDishRowProps = {
  item: {
    id: string;
    name: string;
    description: string | null;
    isAvailable: boolean;
  };
  selected: boolean;
  /** False once the category's quota is full and this dish isn't one of the picks. */
  canSelect: boolean;
  canBook: boolean;
};

/**
 * One dish of the fixed-price set. A checkbox, not a stepper: a set slot is
 * either taken or it isn't, and nobody orders two of the same dish inside one
 * suất.
 */
export function SetDishRow({ item, selected, canSelect, canBook }: SetDishRowProps) {
  // Optimistic local state so ticking feels instant; reconciled by revalidation.
  const [checked, setChecked] = useState(selected);
  const [isPending, startTransition] = useTransition();

  const soldOut = !item.isAvailable && !checked;
  const disabled = !canBook || isPending || soldOut || (!checked && !canSelect);

  function toggle() {
    if (disabled) return;
    const next = !checked;
    setChecked(next);

    startTransition(async () => {
      const result = await toggleSetDish({ menuItemId: item.id, selected: next });
      if (!result.ok) {
        setChecked(!next);
        toast.error(result.error);
      }
    });
  }

  return (
    <label
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        checked ? "border-primary/40 bg-primary/5" : "bg-background"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-accent/50 cursor-pointer"}`}
    >
      {isPending ? (
        <Loader2 className="size-4 shrink-0 animate-spin" />
      ) : (
        <Checkbox checked={checked} disabled={disabled} onCheckedChange={toggle} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.name}</span>
          {soldOut && (
            <Badge variant="secondary" className="text-xs">
              Hết món
            </Badge>
          )}
        </div>
        {item.description && (
          <p className="text-muted-foreground mt-0.5 text-sm">{item.description}</p>
        )}
      </div>
    </label>
  );
}
