"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Signs out and goes straight to `redirectUrl`, which the server picks from the
 * welcome screen's switch — /welcome when it is on, /login when it is off.
 *
 * Not always /welcome and let that page forward: Clerk navigates in-app after
 * signing out, and the router could show a copy of /welcome kept from before
 * the switch was turned off instead of asking the server again.
 */
export function SignOutButton({ redirectUrl }: { redirectUrl: string }) {
  return (
    <ClerkSignOutButton redirectUrl={redirectUrl}>
      <Button variant="ghost" size="sm">
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Đăng xuất</span>
      </Button>
    </ClerkSignOutButton>
  );
}
