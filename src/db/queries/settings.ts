import "server-only";

import { cache } from "react";
import { eq, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { appSettings, type AppSettings } from "@/db/schema";
import { serverEnv } from "@/env";

export const SETTINGS_ID = "default";

/**
 * The settings row without the uploaded bank QR. That image is a few hundred
 * KB of base64, and the (app) layout reads settings on every navigation — often
 * a page and the seasonal backdrop read them again — so it is left out and only
 * whether one exists travels. `getBankQrImage()` is the one read of the bytes.
 */
export type AppSettingsSummary = Omit<AppSettings, "qrImageData" | "qrImageType"> & {
  hasQrImage: boolean;
};

const readSettings = () =>
  db.query.appSettings.findFirst({
    where: eq(appSettings.id, SETTINGS_ID),
    columns: { qrImageData: false, qrImageType: false },
    extras: { hasQrImage: isNotNull(appSettings.qrImageData).mapWith(Boolean).as("has_qr_image") },
  });

/**
 * Reads the single settings row, seeding it from env vars on first access so a
 * fresh install already has the bank details from `.env.local`.
 *
 * Deduplicated per request: the layout, the page and the backdrop share one
 * query. A Server Action that writes settings must not read them back through
 * this within the same request.
 */
export const getAppSettings = cache(async (): Promise<AppSettingsSummary> => {
  const existing = await readSettings();
  if (existing) return existing;

  await db
    .insert(appSettings)
    .values({ id: SETTINGS_ID, ...serverEnv.defaultBank })
    .onConflictDoNothing();

  // Re-read whether we inserted or lost the race with a concurrent request.
  const row = await readSettings();
  if (!row) throw new Error("Could not initialise app settings.");
  return row;
});

/** The admin's uploaded bank QR, or null. Only `/api/bank-qr` needs the bytes. */
export async function getBankQrImage(): Promise<{ data: string; type: string } | null> {
  const [row] = await db
    .select({ data: appSettings.qrImageData, type: appSettings.qrImageType })
    .from(appSettings)
    .where(eq(appSettings.id, SETTINGS_ID))
    .limit(1);
  if (!row?.data || !row.type) return null;
  return { data: row.data, type: row.type };
}
