import "server-only";

import { asc, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { fallbackDisplayName } from "@/lib/display-name";

export type Diner = { id: string; name: string; email: string };

/** Everyone with an account, for the admin's "order on behalf of" picker. */
export async function getAllDiners(): Promise<Diner[]> {
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(users)
    .orderBy(asc(users.displayName), asc(users.email));

  return rows.map((row) => ({
    id: row.id,
    name: row.displayName ?? fallbackDisplayName(row.email),
    email: row.email,
  }));
}

export type Member = {
  id: string;
  /** The stored name, or null when they have never set one. */
  displayName: string | null;
  email: string;
  photoUrl: string | null;
  birthMonth: number | null;
  birthDay: number | null;
  /** Raw from the row — run it through `parseAdminSections()` before use. */
  adminSections: string[];
};

/** Everyone with an account, for the admin's member list. */
export async function getAllMembers(): Promise<Member[]> {
  return db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      photoUrl: users.photoUrl,
      birthMonth: users.birthMonth,
      birthDay: users.birthDay,
      adminSections: users.adminSections,
    })
    .from(users)
    .orderBy(asc(users.displayName), asc(users.email));
}

export type MemberActivity = {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  /** The first sign-in: the row is created then. */
  createdAt: Date;
  /** Null when not seen since tracking began. */
  lastSeenAt: Date | null;
};

/** Everyone, most recently active first — for the full admin's Hoạt động page. */
export async function getMemberActivity(): Promise<MemberActivity[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      photoUrl: users.photoUrl,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
    })
    .from(users)
    .orderBy(sql`${users.lastSeenAt} desc nulls last`, asc(users.email));

  return rows.map(({ displayName, ...row }) => ({
    ...row,
    name: displayName ?? fallbackDisplayName(row.email),
  }));
}
