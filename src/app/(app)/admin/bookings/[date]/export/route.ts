import { requireAdmin } from "@/lib/auth/session";
import { isServiceDate } from "@/lib/date";
import { getDayBill } from "@/lib/day-bill";
import { DEFAULT_SLOT, parseMenuSlot } from "@/lib/menu-slot";
import { renderDayBillImage } from "@/lib/day-bill-image";

export const dynamic = "force-dynamic";
// The fonts are read from disk.
export const runtime = "nodejs";

/**
 * Downloads one sitting's bill as a PNG — lunch unless `?buoi=afternoon`. A
 * route handler is its own endpoint, outside the admin layout's guard, so it
 * checks admin itself.
 */
export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  await requireAdmin();

  const { date } = await params;
  if (!isServiceDate(date)) return new Response("Ngày không hợp lệ.", { status: 404 });

  const slot = parseMenuSlot(new URL(request.url).searchParams.get("buoi") ?? undefined);
  const suffix = slot === DEFAULT_SLOT ? "" : `-${slot}`;

  const image = await renderDayBillImage(await getDayBill(date, slot));
  image.headers.set("Content-Disposition", `attachment; filename="hoa-don-${date}${suffix}.png"`);
  image.headers.set("Cache-Control", "no-store");
  return image;
}
