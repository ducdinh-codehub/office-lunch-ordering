"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Flag,
  Mail,
  NotebookPen,
  ReceiptText,
  Settings2,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { APP_SHORT_NAME } from "@/lib/app-name";

export type NavLink = { href: string; label: string };

/**
 * Icons can't cross the server → client boundary (a component is not
 * serialisable), so the shell passes plain links and they are matched to an icon
 * here by href.
 */
const ICONS: Record<string, LucideIcon> = {
  "/": UtensilsCrossed,
  "/me/bookings": CalendarDays,
  "/me/payments": Wallet,
  "/race": Flag,
  "/admin/menu": UtensilsCrossed,
  "/admin/bookings": ClipboardList,
  "/admin/payments": ReceiptText,
  "/admin/bills": NotebookPen,
  "/admin/emails": Mail,
  "/admin/settings": Settings2,
};

/**
 * The phone-sized navigation: the header shows where you are, and tapping it
 * slides out a drawer with everywhere else.
 *
 * The current page is read from the pathname rather than tracked separately, so
 * there is no second copy of it to drift out of sync.
 */
export function MobileNav({
  userLinks,
  adminLinks,
}: {
  userLinks: NavLink[];
  adminLinks: NavLink[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // A tapped link navigates without unmounting the drawer, so close it on the
  // route change rather than in the click handler — that also covers the back
  // button and any programmatic navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const all = [...userLinks, ...adminLinks];
  // Longest match wins, so /me/payments beats / and /admin/menu beats /admin.
  const current = all
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];

  function renderLink({ href, label }: NavLink) {
    const Icon = ICONS[href];
    const isCurrent = current?.href === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={isCurrent ? "page" : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
          isCurrent
            ? "bg-accent text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        }`}
      >
        {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
        {label}
      </Link>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className="text-muted-foreground hover:text-foreground hover:bg-accent -mx-1 flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors">
        <span aria-hidden className="text-muted-foreground/60">
          /
        </span>
        <span className="text-foreground truncate font-medium">
          {current?.label ?? "Thực đơn"}
        </span>
        <ChevronDown className="size-4 shrink-0" aria-hidden />
      </DrawerTrigger>

      <DrawerContent side="left">
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <span aria-hidden>🍽️</span>
            {APP_SHORT_NAME}
          </DrawerTitle>
        </DrawerHeader>

        <nav className="flex flex-col gap-0.5 p-2">
          {userLinks.map(renderLink)}

          {adminLinks.length > 0 && (
            <>
              <p className="text-muted-foreground mt-3 px-3 pb-1 text-xs font-medium">
                Quản lý
              </p>
              {adminLinks.map(renderLink)}
            </>
          )}
        </nav>
      </DrawerContent>
    </Drawer>
  );
}
