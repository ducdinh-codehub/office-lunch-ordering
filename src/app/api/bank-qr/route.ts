import { getBankQrImage } from "@/db/queries/settings";
import { requireUser } from "@/lib/auth/session";

/**
 * Serves the admin's uploaded bank QR.
 *
 * It lives in a route rather than being inlined as a data URI so the browser can
 * cache it, and so the base64 isn't re-sent inside every render of the payments
 * page. `requireUser()` is called explicitly: middleware attaches the Clerk
 * session but does not protect anything on its own, and this image carries a
 * bank account.
 */
export async function GET() {
  await requireUser();

  const image = await getBankQrImage();
  if (!image) return new Response("Not found", { status: 404 });

  const bytes = Buffer.from(image.data, "base64");

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": image.type,
      "Content-Length": String(bytes.byteLength),
      // Private: it is the group's bank QR, not something a CDN should hold.
      // `updatedAt` is in the URL as a cache-buster, so this can be long-lived.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
