import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { serverEnv } from "@/env";

export type SessionUser = User & { isAdmin: boolean };

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
  if (existing) return { ...existing, isAdmin: isAdminEmail(existing.email) };

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

  return { ...created, isAdmin: isAdminEmail(created.email) };
});

/** Use at the top of every protected page and every Server Action. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/?error=forbidden");
  return user;
}
