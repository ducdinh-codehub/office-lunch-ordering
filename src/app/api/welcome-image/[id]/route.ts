import { eq } from "drizzle-orm";

import { db } from "@/db";
import { emailImages } from "@/db/schema";
import { getAppSettings } from "@/db/queries/settings";

/**
 * Serves the welcome screen's picture to anyone — the people who see it are by
 * definition signed out. Only the picture `app_settings.welcome_image_id`
 * currently points at is served, so this never opens up the email pictures
 * that share the `email_images` table.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const settings = await getAppSettings();
  if (!settings.welcomeImageId || settings.welcomeImageId !== id) {
    return new Response("Not found", { status: 404 });
  }

  const [image] = await db.select().from(emailImages).where(eq(emailImages.id, id));
  if (!image) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(image.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(bytes.byteLength),
      // A replaced picture gets a new id, and so a new URL. Not "immutable":
      // a removed one must stop being served by shared caches too.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
