"use client";

import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { LogOut, UserRound } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The avatar, which opens the profile link and sign-out — kept out of the
 * header itself so the nav has the room.
 *
 * Signing out goes straight to `signOutUrl`, which the server picks from the
 * welcome screen's switch — /welcome when it is on, /login when it is off. Not
 * always /welcome and let that page forward: Clerk navigates in-app after
 * signing out, and the router could show a copy of /welcome kept from before
 * the switch was turned off instead of asking the server again.
 */
export function UserMenu({
  name,
  email,
  photoUrl,
  signOutUrl,
}: {
  name: string;
  email: string;
  photoUrl: string | null;
  signOutUrl: string;
}) {
  const { signOut } = useClerk();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Tài khoản của bạn"
        className="hover:ring-ring data-popup-open:ring-ring rounded-full transition-shadow outline-none hover:ring-2 focus-visible:ring-2 data-popup-open:ring-2"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-medium">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="text-foreground truncate text-sm">{name}</div>
            <div className="truncate font-normal">{email}</div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/me/profile" />}>
          <UserRound />
          Hồ sơ
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut({ redirectUrl: signOutUrl })}>
          <LogOut />
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
