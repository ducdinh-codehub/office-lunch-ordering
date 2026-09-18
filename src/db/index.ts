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
// every edit.
const globalForDb = globalThis as unknown as { __lunchDb?: Database };

export const db: Database = globalForDb.__lunchDb ?? createDb();

if (process.env.NODE_ENV !== "production") globalForDb.__lunchDb = db;

export { schema };
