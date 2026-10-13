import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { getAppSettings } from "@/db/queries/settings";
import { serverEnv } from "@/env";
import { fail } from "@/lib/action-result";
import { ADMIN_SECTIONS, parseAdminSections, type AdminSection } from "@/lib/admin-sections";

/**
 * `isAdmin` is a full admin (ADMIN_EMAILS). `sections` is what this person may
 * manage under /admin — every section for a full admin, else the ones a full
 * admin handed them. Check a section with `canManage()`, not `isAdmin`.
 */
export type SessionUser = User & { isAdmin: boolean; sections: AdminSection[] };

function toSessionUser(row: User): SessionUser {
  const isAdmin = isAdminEmail(row.email);
  return {
    ...row,
    isAdmin,
    sections: isAdmin ? [...ADMIN_SECTIONS] : parseAdminSections(row.adminSections),
  };
}

export function canManage(user: SessionUser | null | undefined, section: AdminSection): boolean {
  return user?.sections.includes(section) ?? false;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return serverEnv.adminEmails.includes(email.toLowerCase());
}

/**
 * Resolves the signed-in user, creating their row on first sight.
 *
 * Clerk owns identity, but the rest of the app joins on our own `users.id`, so
 * every Clerk account needs a local row. Rather than run a webhook (which needs a
 * public URL and a signing secret before anything works locally), we upsert
 * lazily: the common path is a single indexed read, and only a brand-new account
 * pays for the Clerk API call.
 *
 * Returns null rather than throwing so a signed-out request can render normally.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkUserId, clerkUserId),
  });
  if (existing) return toSessionUser(existing);

  // First request after signing up: pull the profile from Clerk and store it.
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!clerkUser || !email) return null;

  const [created] = await db
    .insert(users)
    .values({
      clerkUserId,
      email,
      displayName: clerkUser.fullName,
      photoUrl: clerkUser.imageUrl,
    })
    .onConflictDoUpdate({
      // A person who signs up again with the same address keeps one row, now
      // pointing at their current Clerk account.
      target: users.email,
      set: {
        clerkUserId,
        displayName: clerkUser.fullName,
        photoUrl: clerkUser.imageUrl,
      },
    })
    .returning();

  return toSessionUser(created);
});

/** Use at the top of every protected page and every Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  // Signed out: the welcome screen comes first when the admin has turned it on.
  if (!user) redirect((await getAppSettings()).welcomeEnabled ? "/welcome" : "/login");
  return user;
}

/** A full admin only — ADMIN_EMAILS. For a page of one section, `requireSection()`. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/?error=forbidden");
  return user;
}

/** Use at the top of every /admin page: the layout only checks for *some* section. */
export async function requireSection(section: AdminSection): Promise<SessionUser> {
  const user = await requireUser();
  if (!canManage(user, section)) redirect("/?error=forbidden");
  return user;
}

/** Guards /admin as a whole: anyone holding at least one section. */
export async function requireAnySection(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.sections.length === 0) redirect("/?error=forbidden");
  return user;
}

/**
 * The Server Action counterpart of `requireSection()`: it fails with a message
 * the client shows inline instead of redirecting. Pass no section to require a
 * full admin.
 */
export async function assertSection(section?: AdminSection): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) fail("Bạn đã đăng xuất. Vui lòng đăng nhập lại.");
  if (section ? !canManage(user, section) : !user.isAdmin) {
    fail("Bạn không có quyền thực hiện thao tác này.");
  }
  return user;
}
