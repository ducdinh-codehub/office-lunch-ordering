import { requireAdmin } from "@/lib/auth/session";
import { isServiceDate } from "@/lib/date";
import { getDayBill } from "@/lib/day-bill";
import { renderDayBillImage } from "@/lib/day-bill-image";

export const dynamic = "force-dynamic";
// The fonts are read from disk.
export const runtime = "nodejs";

/**
 * Downloads the day's bill as a PNG. A route handler is its own endpoint,
 * outside the admin layout's guard, so it checks admin itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  await requireAdmin();

  const { date } = await params;
  if (!isServiceDate(date)) return new Response("Ngày không hợp lệ.", { status: 404 });

  const image = await renderDayBillImage(await getDayBill(date));
  image.headers.set("Content-Disposition", `attachment; filename="hoa-don-${date}.png"`);
  image.headers.set("Cache-Control", "no-store");
  return image;
}
