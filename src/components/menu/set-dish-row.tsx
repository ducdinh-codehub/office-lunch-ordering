"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DishNote } from "@/components/menu/dish-note";
import { toggleSetDish } from "@/app/(app)/menu/actions";

export type SetDishRowProps = {
  item: {
    id: string;
    name: string;
    description: string | null;
    isAvailable: boolean;
  };
  selected: boolean;
  /** The diner's note on this dish, when they have picked it. */
  note: string | null;
  /** False once the category's quota is full and this dish isn't one of the picks. */
  canSelect: boolean;
  canBook: boolean;
  /** Set when an admin is picking for someone else. */
  onBehalfOf?: string;
};

/**
 * One dish of the fixed-price set. A checkbox, not a stepper: a set slot is
 * either taken or it isn't, and nobody orders two of the same dish inside one
 * suất.
 */
export function SetDishRow({
  item,
  selected,
  note,
  canSelect,
  canBook,
  onBehalfOf,
}: SetDishRowProps) {
  // Optimistic local state so ticking feels instant.
  const [checked, setChecked] = useState(selected);
  const [isPending, startTransition] = useTransition();

  // ...and the server stays the truth. `useState` only seeds, so a tick would
  // otherwise outlive the booking it stood for: switching suất clears these rows
  // and an admin can change them from another screen. Re-seed whenever the
  // server's answer moves, which it does not do mid-toggle — a pending pick
  // leaves `selected` alone until the action has actually written it.
  const [serverSelected, setServerSelected] = useState(selected);
  if (serverSelected !== selected) {
    setServerSelected(selected);
    setChecked(selected);
  }

  const soldOut = !item.isAvailable && !checked;
  const disabled = !canBook || isPending || soldOut || (!checked && !canSelect);

  function toggle() {
    if (disabled) return;
    const next = !checked;
    setChecked(next);

    startTransition(async () => {
      const result = await toggleSetDish({
        menuItemId: item.id,
        selected: next,
        onBehalfOf,
      });
      if (!result.ok) {
        setChecked(!next);
        toast.error(result.error);
      }
    });
  }

  // The note sits outside the <label>: inside it, every click on the note's
  // input or buttons would also toggle the checkbox.
  return (
    <div
      className={`rounded-lg border transition-colors ${
        checked ? "border-primary/40 bg-primary/5" : "bg-background"
      }`}
    >
      <label
        className={`flex items-center gap-3 rounded-lg p-3 ${
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-accent/50 cursor-pointer"
        }`}
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
      {/* The saved pick, not the optimistic tick: a note needs a row to land on. */}
      {selected && checked && (
        <div className="-mt-1.5 px-3 pb-3 pl-10">
          <DishNote
            menuItemId={item.id}
            dishName={item.name}
            note={note}
            canEdit={canBook}
            onBehalfOf={onBehalfOf}
          />
        </div>
      )}
    </div>
  );
}
