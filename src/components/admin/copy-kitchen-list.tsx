"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type State = "idle" | "copied" | "failed";

/**
 * Copies the order summary so it can be pasted straight into a chat with the
 * restaurant.
 *
 * `navigator.clipboard` is unavailable on an insecure origin and blocked
 * outright in some in-app browsers (Zalo's included), so a failure falls back
 * to the old `execCommand` path and, failing that, says so instead of looking
 * like a dead button.
 */
export function CopyKitchenList({ text }: { text: string }) {
  const [state, setState] = useState<State>("idle");

  function flash(next: State) {
    setState(next);
    setTimeout(() => setState("idle"), 2000);
  }

  function copyViaTextarea(): boolean {
    const field = document.createElement("textarea");
    field.value = text;
    // Off-screen rather than hidden: a display:none field cannot be selected.
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.top = "-1000px";
    document.body.appendChild(field);
    field.select();
    field.setSelectionRange(0, text.length);
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(field);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      flash("copied");
      return;
    } catch {
      // Fall through to the legacy path.
    }
    flash(copyViaTextarea() ? "copied" : "failed");
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {state === "copied" ? (
        <Check className="size-4" />
      ) : state === "failed" ? (
        <X className="size-4" />
      ) : (
        <Copy className="size-4" />
      )}
      {state === "copied" ? "Đã chép" : state === "failed" ? "Không chép được" : "Chép"}
    </Button>
  );
}
