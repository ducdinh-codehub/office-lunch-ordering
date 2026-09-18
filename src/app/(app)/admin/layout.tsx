import { requireAdmin } from "@/lib/auth/session";

/**
 * Guards the whole /admin subtree. This is a convenience, not the security
 * boundary — every admin Server Action re-checks with `requireAdmin()` itself.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}
