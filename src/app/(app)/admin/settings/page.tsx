import { sql } from "drizzle-orm";

import { SettingsForm } from "@/components/admin/settings-form";
import { GreetingEditor } from "@/components/admin/greeting-editor";
import { HomeThemePicker } from "@/components/admin/home-theme-picker";
import { LuckyEnvelopeSettings } from "@/components/admin/lucky-envelope-settings";
import { MemberList } from "@/components/admin/member-list";
import { ResetOrders } from "@/components/admin/reset-orders";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getAppSettings } from "@/db/queries/settings";
import { getEnvelopeStats } from "@/db/queries/lucky-envelopes";
import { getAllMembers } from "@/db/queries/users";
import { parseHomeTheme } from "@/lib/home-themes";
import { fallbackDisplayName } from "@/lib/display-name";
import { isAdminEmail, requireAdmin } from "@/lib/auth/session";
import { toBirthday } from "@/lib/birthday";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Cài đặt") };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const [settings, [{ count: bookingCount }], members, envelopeStats] = await Promise.all([
    getAppSettings(),
    db.select({ count: sql<number>`count(*)::int` }).from(bookings),
    getAllMembers(),
    getEnvelopeStats(),
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

      <HomeThemePicker homeTheme={parseHomeTheme(settings.homeTheme)} />

      <GreetingEditor greetingMessage={settings.greetingMessage} />

      <LuckyEnvelopeSettings
        enabled={settings.luckyEnvelopeEnabled}
        opened={envelopeStats.opened}
        byPercent={envelopeStats.byPercent}
      />

      <MemberList
        members={members.map((member) => ({
          id: member.id,
          displayName: member.displayName ?? "",
          fallbackName: fallbackDisplayName(member.email),
          email: member.email,
          photoUrl: member.photoUrl,
          birthday: toBirthday(member.birthMonth, member.birthDay),
          // Admin is ADMIN_EMAILS, evaluated here on the server — there is no
          // role column and nothing admin-ish is sent to the client but this.
          isAdmin: isAdminEmail(member.email),
        }))}
      />

      <ResetOrders bookingCount={bookingCount} />
    </div>
  );
}
