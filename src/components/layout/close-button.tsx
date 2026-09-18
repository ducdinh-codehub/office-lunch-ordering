"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Closes a detail view and returns to wherever the person came from.
 *
 * Prefers real history so "back" means the list they actually opened this from —
 * the bookings list, the payments list, or the day before. A deep link (a
 * pasted URL, a fresh tab) has no history to go back to, so it falls through to
 * `fallbackHref` rather than dropping them out of the app.
 */
export function CloseButton({
  fallbackHref,
  label = "Đóng",
}: {
  fallbackHref: string;
  label?: string;
}) {
  const router = useRouter();

  function close() {
    // `length > 1` means something preceded this page in the tab's history.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <Button variant="ghost" size="icon" onClick={close} aria-label={label} title={label}>
      <X className="size-4" />
    </Button>
  );
}
