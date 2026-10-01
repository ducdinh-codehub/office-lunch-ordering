import { eq } from "drizzle-orm";

import { db } from "@/db";
import { emailImages } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Serves a picture uploaded for an email, to the admin only — the editor and
 * the email previews are the only places it is shown in the app. Recipients
 * never load it from here: sending attaches it to the email itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Not found", { status: 404 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });

  const [image] = await db.select().from(emailImages).where(eq(emailImages.id, id));
  if (!image) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(image.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(bytes.byteLength),
      // An id is never reused for different bytes, so it can be cached for good.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
