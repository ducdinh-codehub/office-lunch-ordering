import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  ReceiptText,
  Settings2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { SignOutButton } from "./sign-out-button";
import { MobileNav } from "./mobile-nav";
import type { SessionUser } from "@/lib/auth/session";

const userLinks = [
  { href: "/", label: "Hôm nay", icon: UtensilsCrossed },
  { href: "/me/bookings", label: "Đơn của tôi", icon: CalendarDays },
  { href: "/me/payments", label: "Thanh toán", icon: Wallet },
];

const adminLinks = [
  { href: "/admin/menu", label: "Thực đơn", icon: UtensilsCrossed },
  { href: "/admin/bookings", label: "Đơn hàng", icon: ClipboardList },
  { href: "/admin/payments", label: "Bảng thu", icon: ReceiptText },
  { href: "/admin/settings", label: "Cài đặt", icon: Settings2 },
];

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/30 min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <span aria-hidden className="text-lg">
              🍽️
            </span>
            <span className="hidden sm:inline">Lunch Time</span>
          </Link>

          {/* Phone: a breadcrumb showing where you are, which opens the rest. */}
          <div className="flex min-w-0 flex-1 items-center sm:hidden">
            <MobileNav
              userLinks={userLinks.map(({ href, label }) => ({ href, label }))}
              adminLinks={
                user.isAdmin ? adminLinks.map(({ href, label }) => ({ href, label })) : []
              }
            />
          </div>

          {/* Wider screens have room for the links themselves. */}
          <nav className="text-muted-foreground hidden flex-1 items-center gap-1 text-sm sm:flex">
            {userLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="hover:text-foreground hover:bg-accent flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
            {user.isAdmin && (
              <>
                <span className="bg-border mx-1 h-5 w-px" aria-hidden />
                {adminLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="hover:text-foreground hover:bg-accent flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors"
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {/* The way in to the profile, on every screen size — so it is still
                reachable when the account has no avatar to click. */}
            <Link
              href="/me/profile"
              title="Hồ sơ của bạn"
              className="hover:ring-ring rounded-full transition-shadow hover:ring-2"
            >
              {user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoUrl}
                  alt="Hồ sơ của bạn"
                  className="size-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-full text-xs font-medium">
                  {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
                </span>
              )}
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-16">{children}</main>
    </div>
  );
}
