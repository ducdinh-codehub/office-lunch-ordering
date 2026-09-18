"use client";

import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <ClerkSignOutButton redirectUrl="/login">
      <Button variant="ghost" size="sm">
        <LogOut className="size-4" />
        <span className="hidden sm:inline">Đăng xuất</span>
      </Button>
    </ClerkSignOutButton>
  );
}
