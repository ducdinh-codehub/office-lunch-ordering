"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Lands on /welcome, which forwards to /login when the welcome screen is off. */
export function SignOutButton() {
  return (
    <ClerkSignOutButton redirectUrl="/welcome">
      <Button variant="ghost" size="sm">
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Đăng xuất</span>
      </Button>
    </ClerkSignOutButton>
  );
}
