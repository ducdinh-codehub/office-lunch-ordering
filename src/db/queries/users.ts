import "server-only";

import { asc } from "drizzle-orm";

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
    })
    .from(users)
    .orderBy(asc(users.displayName), asc(users.email));
}
