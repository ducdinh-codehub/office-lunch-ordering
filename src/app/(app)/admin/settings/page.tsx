import { sql } from "drizzle-orm";

import { SettingsForm } from "@/components/admin/settings-form";
import { ResetOrders } from "@/components/admin/reset-orders";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getAppSettings } from "@/db/queries/settings";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cài đặt · Lunch Time" };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, [{ count: bookingCount }]] = await Promise.all([
    getAppSettings(),
    db.select({ count: sql<number>`count(*)::int` }).from(bookings),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cài đặt</h1>
        <p className="text-muted-foreground text-sm">
          Tài khoản mà mọi người chuyển tiền đến. Mã QR ở trang thanh toán lấy từ đây.
        </p>
      </div>

      <SettingsForm
        bankCode={settings.bankCode}
        bankAccountNo={settings.bankAccountNo}
        bankAccountName={settings.bankAccountName}
        qrTemplate={settings.qrTemplate}
        defaultShipFeeVnd={settings.defaultShipFeeVnd}
        qrImageStamp={settings.qrImageData ? String(settings.updatedAt.getTime()) : null}
      />

      <ResetOrders bookingCount={bookingCount} />
    </div>
  );
}
