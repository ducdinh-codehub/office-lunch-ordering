"use client";

import { useAuth } from "@clerk/nextjs";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "welcome-forwarded-at";

/**
 * Sends a browser that is already signed in on to home, with a full load.
 *
 * The server forwards a signed-in visitor itself, but right after sign-in
 * Clerk moves to `/` in-app, and a request that lands before the server sees
 * the new session is sent here by `requireUser()` — where, unlike /login,
 * nothing used to notice the session and move on. A full load carries the
 * session properly. It is tried once in a while, never in a loop: if the
 * server still disagrees, the visitor stays on the welcome screen.
 *
 * While the reload is on its way, a spinner covers the welcome screen so it
 * does not look like sign-in failed.
 */
export function SignedInForward() {
  const { isLoaded, isSignedIn } = useAuth();
  // Set when a reload was refused, to take the cover away again.
  const [stayed, setStayed] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const last = Number(sessionStorage.getItem(KEY));
      if (Date.now() - last >= 15_000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.replace("/");
        return;
      }
    } catch {
      // Without storage there is no telling a loop apart; stay put.
    }
    setStayed(true);
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn || stayed) return null;
  return (
    <div
      role="status"
      className="bg-background fixed inset-0 z-50 flex flex-col items-center justify-center gap-3"
    >
      <LoaderCircle aria-hidden className="text-muted-foreground size-8 animate-spin" />
      <p className="text-muted-foreground text-sm">Đang đăng nhập…</p>
    </div>
  );
}
