import { listManualBillsOn } from "@/db/queries/manual-bills";
import { getPaymentRoster } from "@/db/queries/payments";
import { requireSection } from "@/lib/auth/session";
import { isServiceDate } from "@/lib/date";
import { renderManualBillsImage } from "@/lib/manual-bill-image";

export const dynamic = "force-dynamic";
// The fonts are read from disk.
export const runtime = "nodejs";

/**
 * Downloads a date's hand-written bills as a PNG — one with `?id=` (the row
 * button on Đơn hàng), else all of them. "Tải ảnh hóa đơn" already draws them
 * all inside the day bill. Guarded like that download: a route handler is
 * outside the admin layout's guard and checks for itself.
 */
export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  await requireSection("bookings");

  const { date } = await params;
  if (!isServiceDate(date)) return new Response("Ngày không hợp lệ.", { status: 404 });

  const id = new URL(request.url).searchParams.get("id");
  const [allBills, roster] = await Promise.all([
    listManualBillsOn(date),
    getPaymentRoster(date, date),
  ]);
  const bills = id ? allBills.filter((bill) => bill.id === id) : allBills;
  if (id && bills.length === 0) return new Response("Không tìm thấy hoá đơn.", { status: 404 });

  const states = new Map(
    roster.rows.flatMap((row) => {
      const cell = row.cells.get(date);
      return cell ? [[row.userId, cell.state] as const] : [];
    }),
  );

  const image = await renderManualBillsImage({ date, bills, states });
  const suffix = id ? `-${id.slice(0, 8)}` : "";
  image.headers.set(
    "Content-Disposition",
    `attachment; filename="hoa-don-rieng-${date}${suffix}.png"`,
  );
  image.headers.set("Cache-Control", "no-store");
  return image;
}
