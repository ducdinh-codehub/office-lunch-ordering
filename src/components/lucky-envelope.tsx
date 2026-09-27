"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { openLuckyEnvelope, type OpenedEnvelope } from "@/app/(app)/actions";
import { formatServiceDateShort } from "@/lib/date";

/** Gold sparkles thrown out when the envelope opens: angle and distance of each. */
const SPARKS = Array.from({ length: 14 }, (_, i) => ({
  angle: (i * 360) / 14,
  distance: 110 + (i % 3) * 30,
  delay: (i % 4) * 0.04,
}));

type Stage = "closed" | "opening" | "opened";

const subscribeNever = () => () => {};

/**
 * Portalled to <body>: the home page's root is `relative isolate` (so the
 * seasonal backdrop sits behind the cards), which would trap this overlay in
 * that stacking context — under the sticky header, still bright and clickable.
 */
function BodyPortal({ children }: { children: React.ReactNode }) {
  // False on the server and during hydration, true once on the client.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  return mounted ? createPortal(children, document.body) : null;
}

/**
 * The lì xì may mắn: a big red envelope in the middle of the screen, opened
 * with one tap. The prize is drawn on the server — this only shows it.
 *
 * The home page renders this always, and says through `eligible` whether it
 * may be offered: the feature is on, this person has not opened theirs this
 * round, and today is not yet paid. Always rendered, because opening flips
 * `eligible` — the action revalidates the page, which then knows the envelope
 * is open — and an unmounted component would take the reveal with it. Its own
 * `stage` carries the reveal through that refresh instead.
 *
 * "Để sau" tucks it into a small button at the bottom of the screen rather
 * than losing it.
 */
export function LuckyEnvelope({ eligible }: { eligible: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [stage, setStage] = useState<Stage>("closed");
  const [result, setResult] = useState<OpenedEnvelope | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const envelopeRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  // Escape puts it away for now, as "Để sau" does — but not mid-draw.
  useEffect(() => {
    if (dismissed || (!eligible && stage === "closed")) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && stage !== "opening") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (dismissed) return;
    (stage === "opened" ? doneRef : envelopeRef).current?.focus();
  }, [stage, dismissed]);

  function close() {
    if (stage === "opened") {
      // Opened: nothing left to show. Refresh so every total picks up the discount.
      router.refresh();
    }
    setDismissed(true);
  }

  function open() {
    if (stage !== "closed" || isPending) return;
    setStage("opening");
    startTransition(async () => {
      const [response] = await Promise.all([
        openLuckyEnvelope(),
        // A beat of suspense, however fast the server is.
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);
      if (!response.ok || !response.data) {
        toast.error(response.ok ? "Không mở được lì xì." : response.error);
        // Back to closed, so the refresh below — which knows why it failed —
        // decides whether the envelope is still on offer at all.
        setStage("closed");
        setDismissed(true);
        router.refresh();
        return;
      }
      setResult(response.data);
      setStage("opened");
    });
  }

  // Showing the prize outlives `eligible`; everything else needs it.
  if (!eligible && stage === "closed") return null;

  // Put away but not opened: a small way back to it.
  if (dismissed && stage !== "opened") {
    return (
      <BodyPortal>
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="lixi-pill fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-300 bg-gradient-to-b from-red-600 to-red-700 px-4 py-2 text-sm font-medium text-amber-100 shadow-lg shadow-red-900/30"
        >
          <span aria-hidden>🧧</span>
          Mở lì xì may mắn
        </button>
      </BodyPortal>
    );
  }
  if (dismissed) return null;

  const big = result?.percent === 20;

  return (
    <BodyPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lixi-title"
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      >
        <div className="flex w-full max-w-xs flex-col items-center gap-5">
          <h2
            id="lixi-title"
            className="text-center text-xl font-semibold tracking-tight text-white drop-shadow"
          >
            {stage === "opened" ? (
              big ? (
                "Trúng lớn! 🎉"
              ) : (
                "Chúc mừng! 🎉"
              )
            ) : (
              // Gold, like the envelope's trim, with a red glow to lift it off
              // the dimmed page.
              <span className="bg-gradient-to-b from-yellow-100 via-amber-300 to-amber-500 bg-clip-text text-3xl font-bold text-transparent drop-shadow-[0_2px_8px_rgb(220_38_38/0.6)]">
                Chúc mừng năm mới
              </span>
            )}
          </h2>

          {/* Drops as the card rises, so the card never covers the heading. */}
          <div
            className={`relative transition-[margin] duration-700 ease-out [perspective:900px] ${
              stage === "opened" ? "mt-36" : "mt-0"
            }`}
          >
            {/* The prize card, tucked inside until the flap opens. */}
            <div
              className={`absolute inset-x-5 top-6 z-0 flex flex-col items-center rounded-xl bg-amber-50 px-3 pt-5 pb-10 text-center shadow-lg transition-transform duration-700 ease-out ${
                stage === "opened" ? "-translate-y-36 delay-300" : "translate-y-0"
              }`}
              aria-live="polite"
            >
              {result && (
                <>
                  <p className="text-xs font-medium tracking-wide text-red-700 uppercase">Giảm</p>
                  <p
                    className={`font-bold text-red-600 tabular-nums ${big ? "text-6xl" : "text-5xl"}`}
                  >
                    {result.percent}%
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    hoá đơn hôm nay ({formatServiceDateShort(result.serviceDate)})
                  </p>
                </>
              )}
            </div>

            <button
              ref={envelopeRef}
              type="button"
              onClick={open}
              disabled={stage !== "closed"}
              aria-label={stage === "closed" ? "Chạm để mở lì xì" : "Đang mở lì xì"}
              className={`relative z-10 block h-72 w-56 rounded-2xl outline-none focus-visible:ring-4 focus-visible:ring-amber-300 sm:h-80 sm:w-64 ${
                stage === "closed" ? "lixi-wiggle cursor-pointer" : ""
              } ${stage === "opening" ? "lixi-shake" : ""}`}
            >
              {/* Body. */}
              <span className="absolute inset-0 overflow-hidden rounded-2xl border-2 border-amber-300 bg-gradient-to-b from-red-600 via-red-600 to-red-800 shadow-2xl shadow-red-950/50">
                {/* A faint gold pattern. */}
                <span className="absolute inset-3 rounded-xl border border-amber-300/40" />
                <span className="absolute inset-x-0 bottom-6 text-center text-sm font-medium tracking-wide text-amber-200/90">
                  {stage === "closed" ? "Chạm để mở" : stage === "opening" ? "Đang mở…" : " "}
                </span>
              </span>

              {/* Flap: folds back when opened, and — its back face hidden —
                vanishes as it turns, so it never covers the rising card. */}
              <svg
                className={`absolute inset-x-0 top-0 h-1/2 w-full origin-top transition-transform duration-500 ease-in-out [backface-visibility:hidden] ${
                  stage === "opened" ? "[transform:rotateX(180deg)]" : ""
                }`}
                viewBox="0 0 100 50"
                preserveAspectRatio="none"
              >
                <path
                  d="M2 2 H98 L50 46 Z"
                  fill="#b91c1c"
                  stroke="#fcd34d"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* The seal, over the flap's point. */}
              <span
                className={`absolute top-[38%] left-1/2 grid size-20 -translate-x-1/2 place-items-center rounded-full border-2 border-amber-200 bg-gradient-to-b from-amber-300 to-amber-500 text-xl leading-none font-bold text-red-700 shadow-lg transition-opacity duration-300 ${
                  stage === "opened" ? "opacity-0" : "opacity-100"
                }`}
              >
                Lì Xì
              </span>
            </button>

            {stage === "opened" &&
              SPARKS.map((spark, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="lixi-spark absolute top-1/3 left-1/2 z-20 size-2 rounded-full bg-amber-300"
                  style={
                    {
                      "--spark-x": `${Math.cos((spark.angle * Math.PI) / 180) * spark.distance}px`,
                      "--spark-y": `${Math.sin((spark.angle * Math.PI) / 180) * spark.distance}px`,
                      animationDelay: `${0.3 + spark.delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
          </div>

          {stage === "opened" ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-sm text-white/90">
                Đã trừ vào tổng tiền hôm nay — áp dụng cho cả món, suất và phí ship.
              </p>
              <Button
                ref={doneRef}
                onClick={close}
                className="bg-amber-400 text-red-900 hover:bg-amber-300"
              >
                Tuyệt vời!
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={close}
              disabled={stage === "opening"}
              className="text-sm text-white/80 underline underline-offset-4 hover:text-white disabled:opacity-50"
            >
              Để sau
            </button>
          )}
        </div>
      </div>
    </BodyPortal>
  );
}
