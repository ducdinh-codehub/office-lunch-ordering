import { requireAnySection } from "@/lib/auth/session";

/**
 * Guards the whole /admin subtree for anyone holding at least one section.
 * This is a convenience, not the security boundary — every page checks its own
 * section with `requireSection()`, and every Server Action with `assertSection()`.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAnySection();
  return <>{children}</>;
}
