import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";

import { serverEnv } from "@/env";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

/**
 * Two drivers, picked from the connection string:
 *
 * - Neon (`*.neon.tech`) uses the HTTP driver: one round-trip per query and no
 *   pool to manage, which is what serverless wants. The trade-off is no
 *   interactive transactions.
 * - Anything else (a local Postgres, Docker, Supabase direct) uses node-postgres,
 *   so the app runs without a Neon account.
 *
 * Both expose the same query-builder surface, so the rest of the app is typed
 * against one `Database` and never has to care which is in use.
 */
function createDb(): Database {
  const url = serverEnv.databaseUrl;

  if (url.includes("neon.tech")) {
    return drizzleNeon(neon(url), { schema });
  }

  return drizzlePg(url, { schema }) as unknown as Database;
}

// Cached on globalThis so Next's dev-mode hot reload doesn't open a new pool on
// every edit — but only while the schema is the same one. The client keeps the
// schema it was built with, so a cached client outliving an edit to schema.ts
// silently drops the new columns from every `db.query` read until a restart.
// (Its own key: a module compiled before this shape existed reads `__lunchDb`
// as a bare client, and must never be handed this pair instead.)
const globalForDb = globalThis as unknown as {
  __lunchDbWithSchema?: { db: Database; schema: typeof schema };
};

const cached = globalForDb.__lunchDbWithSchema;
export const db: Database = cached?.schema === schema ? cached.db : createDb();

if (process.env.NODE_ENV !== "production") globalForDb.__lunchDbWithSchema = { db, schema };

export { schema };
