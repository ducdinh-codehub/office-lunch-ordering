"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * "Mua cho tôi cốc cà phê" — a tip jar for whoever runs the lunch order.
 *
 * The QR carries no amount on purpose: the whole point is mệnh giá tuỳ tâm, so
 * the sender types whatever they like in their banking app. The memo still
 * carries their name, so a coffee never looks like a lunch payment in the
 * account — nothing about this touches the ledger.
 */
export function DonateButton({
  qrUrl,
  memo,
  accountName,
  accountNo,
}: {
  qrUrl: string;
  memo: string;
  accountName: string;
  accountNo: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mua cho tôi cốc cà phê"
        className="donate-fab group fixed right-4 bottom-4 z-30 rounded-full focus-visible:outline-none"
      >
        {/* A halo that keeps breathing — the part you catch out of the corner of
            your eye. Blurred and behind, so it never fights the label. */}
        <span
          aria-hidden
          className="absolute -inset-1 animate-pulse rounded-full bg-gradient-to-r from-amber-400 via-rose-400 to-violet-500 opacity-60 blur-md"
        />

        <span className="animate-donate-sheen relative flex items-center gap-2 rounded-full bg-[linear-gradient(110deg,#f59e0b,#fb7185,#a855f7,#f59e0b)] bg-[length:300%_100%] px-4 py-3 text-sm font-semibold text-white shadow-lg ring-1 ring-white/25 transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <span className="relative">
            <span className="animate-donate-wiggle block text-base leading-none" aria-hidden>
              ☕
            </span>
            {/* Two wisps of steam, offset so they do not puff in lockstep. */}
            <span
              aria-hidden
              className="animate-donate-steam absolute -top-1.5 left-1 size-1 rounded-full bg-white/80"
            />
            <span
              aria-hidden
              className="animate-donate-steam absolute -top-2 left-2.5 size-1 rounded-full bg-white/60"
              style={{ animationDelay: "0.9s" }}
            />
          </span>
          <span className="hidden sm:inline">Donate me</span>
          <span aria-hidden className="hidden text-base leading-none sm:inline">
            💖
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="donate-card overflow-hidden bg-gradient-to-br from-amber-50 via-rose-50 to-violet-50 sm:max-w-sm dark:from-amber-950/70 dark:via-rose-950/60 dark:to-violet-950/70">
          {/* Decoration, drifting gently. Behind everything and unclickable, so
              it can never get between a finger and the QR. */}
          <span
            aria-hidden
            className="animate-donate-float pointer-events-none absolute top-14 -left-3 -z-10 text-4xl opacity-25 select-none"
          >
            🧋
          </span>
          <span
            aria-hidden
            className="animate-donate-float pointer-events-none absolute -right-2 bottom-16 -z-10 text-4xl opacity-25 select-none"
            style={{ animationDelay: "1.6s" }}
          >
            🍰
          </span>
          <span
            aria-hidden
            className="animate-donate-float pointer-events-none absolute right-16 -bottom-2 -z-10 text-3xl opacity-20 select-none"
            style={{ animationDelay: "2.8s" }}
          >
            ✨
          </span>

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span aria-hidden className="animate-donate-wiggle text-xl">
                ☕
              </span>
              <span className="bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500 bg-clip-text text-transparent">
                Donate me
              </span>
            </DialogTitle>
            <DialogDescription
              render={
                <p className="rounded-2xl border border-rose-200/80 bg-white/70 px-3 py-2 text-rose-900 dark:border-rose-900/60 dark:bg-black/20 dark:text-rose-100">
                  Nếu bạn yêu tôi hãy mua cho tôi cốc cà phê, mệnh giá tuỳ tâm 💖
                </p>
              }
            />
          </DialogHeader>

          <div className="flex flex-col items-center gap-2">
            {/* A gradient frame around a plain white plate: a QR needs quiet,
                high-contrast surroundings to scan on the first try. */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-400 via-rose-400 to-violet-500 p-[3px] shadow-md">
              <div className="rounded-[13px] bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="Mã QR chuyển khoản"
                  className="w-full max-w-[240px] rounded-lg"
                />
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Quét bằng app ngân hàng, nhập số tiền tuỳ bạn 🥰
            </p>
          </div>

          {/* An uploaded QR photo is often all the admin has configured — the
              account fields stay empty then, and an empty row reads as a bug. */}
          <dl className="space-y-1.5 rounded-2xl border border-violet-200/70 bg-white/70 p-3 text-sm dark:border-violet-900/60 dark:bg-black/20">
            {accountName && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Chủ tài khoản</dt>
                <dd className="font-medium">{accountName}</dd>
              </div>
            )}
            {accountNo && (
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Số tài khoản</dt>
                <dd className="font-mono text-xs">{accountNo}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Nội dung</dt>
              <dd className="rounded-full bg-gradient-to-r from-amber-100 to-rose-100 px-2 py-0.5 font-mono text-xs text-rose-900 dark:from-amber-900/50 dark:to-rose-900/50 dark:text-rose-100">
                {memo}
              </dd>
            </div>
          </dl>

          <DialogClose
            render={
              <Button className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-violet-500 text-white shadow-md transition-transform hover:scale-[1.02] hover:opacity-95">
                Đóng
              </Button>
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
