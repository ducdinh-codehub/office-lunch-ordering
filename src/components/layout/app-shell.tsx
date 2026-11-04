import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  Flag,
  Mail,
  NotebookPen,
  ReceiptText,
  Settings2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";
import { DonateButton } from "./donate-button";
import { APP_SHORT_NAME } from "@/lib/app-name";
import { fallbackDisplayName } from "@/lib/display-name";
import { ADMIN_SECTION_INFO, type AdminSection } from "@/lib/admin-sections";
import type { SessionUser } from "@/lib/auth/session";

const userLinks = [
  { href: "/", label: "Hôm nay", icon: UtensilsCrossed },
  { href: "/me/bookings", label: "Đơn của tôi", icon: CalendarDays },
  { href: "/me/payments", label: "Thanh toán", icon: Wallet },
  { href: "/race", label: "Đua", icon: Flag },
];

const adminIcons: Record<AdminSection, typeof UtensilsCrossed> = {
  menu: UtensilsCrossed,
  bookings: ClipboardList,
  payments: ReceiptText,
  bills: NotebookPen,
  emails: Mail,
  settings: Settings2,
};

export function AppShell({
  user,
  donate,
  signOutUrl,
  children,
}: {
  user: SessionUser;
  /** Where signing out lands: the welcome screen when it is on, else /login. */
  signOutUrl: string;
  /** Null when no bank account is set up — nothing to donate to. */
  donate: React.ComponentProps<typeof DonateButton> | null;
  children: React.ReactNode;
}) {
  // Only the sections this person holds — every one for a full admin.
  const adminLinks = user.sections.map((section) => ({
    href: ADMIN_SECTION_INFO[section].href,
    label: ADMIN_SECTION_INFO[section].label,
    icon: adminIcons[section],
  }));
  // Who uses the app and when is not a section anyone can be handed: full admins only.
  if (user.isAdmin) adminLinks.push({ href: "/admin/activity", label: "Hoạt động", icon: Activity });

  return (
    <div className="bg-muted/30 min-h-dvh">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <span aria-hidden className="text-lg">
              🍽️
            </span>
            <span className="hidden sm:inline">{APP_SHORT_NAME}</span>
          </Link>

          {/* Phone: a breadcrumb showing where you are, which opens the rest. */}
          <div className="flex min-w-0 flex-1 items-center sm:hidden">
            <MobileNav
              userLinks={userLinks.map(({ href, label }) => ({ href, label }))}
              adminLinks={adminLinks.map(({ href, label }) => ({ href, label }))}
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
            {adminLinks.length > 0 && (
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

          {/* Profile and sign-out live behind the avatar, on every screen size. */}
          <UserMenu
            name={user.displayName || fallbackDisplayName(user.email)}
            email={user.email}
            photoUrl={user.photoUrl}
            signOutUrl={signOutUrl}
          />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>

      {donate && <DonateButton {...donate} />}
    </div>
  );
}
