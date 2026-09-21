import "server-only";

import { asc } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

export type Diner = { id: string; name: string; email: string };

/** Everyone with an account, for the admin's "order on behalf of" picker. */
export async function getAllDiners(): Promise<Diner[]> {
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, email: users.email })
    .from(users)
    .orderBy(asc(users.displayName), asc(users.email));

  return rows.map((row) => ({
    id: row.id,
    name: row.displayName ?? row.email.split("@")[0],
    email: row.email,
  }));
}
