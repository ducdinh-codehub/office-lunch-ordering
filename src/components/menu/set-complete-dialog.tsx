"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Says so, once, when a suất becomes complete.
 *
 * `complete` is recomputed on the server after every pick, so this watches for
 * the moment it turns true rather than its value: opening on the value alone
 * would pop the dialog again on every revalidation, and every time the diner
 * simply revisits a day they already finished.
 */
export function SetCompleteDialog({
  complete,
  detail,
}: {
  complete: boolean;
  /** One line under the message, e.g. the price of the suất they completed. */
  detail?: string;
}) {
  const [open, setOpen] = useState(false);
  // Seeded with the value this mounted at, so arriving on an already-complete
  // day is silent — only finishing one here and now is worth interrupting for.
  const wasComplete = useRef(complete);

  useEffect(() => {
    if (complete && !wasComplete.current) setOpen(true);
    wasComplete.current = complete;
  }, [complete]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Bạn đã chọn đủ số món</DialogTitle>
          {detail && <DialogDescription>{detail}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button className="w-full sm:w-auto">Đóng</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
