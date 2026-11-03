"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquareText, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setBookingNote } from "@/app/(app)/menu/actions";
import { DISH_NOTE_MAX } from "@/lib/dish-note";

/**
 * The diner's own note on a dish they ordered — "ít cay", "không hành" — read
 * by the quán on the kitchen list. Shown only once the dish is ordered: a note
 * belongs to a booking, and `setBookingNote` refuses one without it.
 *
 * Once ordering closes the note is still shown, just no longer editable.
 */
export function DishNote({
  menuItemId,
  dishName,
  note,
  canEdit,
  onBehalfOf,
}: {
  menuItemId: string;
  dishName: string;
  /** The saved note, from the server. */
  note: string | null;
  canEdit: boolean;
  onBehalfOf?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [isPending, startTransition] = useTransition();

  // `useState` only seeds: re-seed when the saved note moves, e.g. the dish was
  // dropped and picked again, or an admin wrote it on this diner's behalf.
  const [seed, setSeed] = useState(note);
  if (seed !== note) {
    setSeed(note);
    setDraft(note ?? "");
  }

  function save() {
    startTransition(async () => {
      const result = await setBookingNote({ menuItemId, note: draft, onBehalfOf });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEditing(false);
      toast.success(draft.trim() ? `Đã lưu ghi chú cho ${dishName}.` : "Đã xoá ghi chú.");
    });
  }

  function cancel() {
    setDraft(note ?? "");
    setEditing(false);
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Input
          autoFocus
          value={draft}
          maxLength={DISH_NOTE_MAX}
          placeholder="VD: ít cay, không hành…"
          aria-label={`Ghi chú cho ${dishName}`}
          disabled={isPending}
          className="h-8 text-sm"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") cancel();
          }}
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Lưu
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={cancel}>
          Huỷ
        </Button>
      </form>
    );
  }

  if (!canEdit) {
    if (!note) return null;
    return (
      <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
        <MessageSquareText className="mt-0.5 size-3.5 shrink-0" />
        <span className="break-words">{note}</span>
      </p>
    );
  }

  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-foreground flex max-w-full items-start gap-1.5 text-left text-sm transition-colors"
      onClick={() => setEditing(true)}
    >
      {note ? (
        <>
          <MessageSquareText className="mt-0.5 size-3.5 shrink-0" />
          <span className="break-words">{note}</span>
          <Pencil className="mt-0.5 size-3 shrink-0" aria-label="Sửa ghi chú" />
        </>
      ) : (
        <>
          <Pencil className="mt-0.5 size-3.5 shrink-0" />
          <span>Thêm ghi chú</span>
        </>
      )}
    </button>
  );
}
