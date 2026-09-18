import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appSettings, type AppSettings } from "@/db/schema";
import { serverEnv } from "@/env";

export const SETTINGS_ID = "default";

/**
 * Reads the single settings row, seeding it from env vars on first access so a
 * fresh install already has the bank details from `.env.local`.
 */
export async function getAppSettings(): Promise<AppSettings> {
  const existing = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });
  if (existing) return existing;

  const defaults = serverEnv.defaultBank;
  const [created] = await db
    .insert(appSettings)
    .values({ id: SETTINGS_ID, ...defaults })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  // Lost the race with a concurrent request — re-read.
  const row = await db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
  });
  if (!row) throw new Error("Could not initialise app settings.");
  return row;
}
