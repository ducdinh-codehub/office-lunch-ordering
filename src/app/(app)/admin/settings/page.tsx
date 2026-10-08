import { sql } from "drizzle-orm";

import { SettingsForm } from "@/components/admin/settings-form";
import { AdminDiscountSettings } from "@/components/admin/admin-discount-settings";
import { GreetingEditor } from "@/components/admin/greeting-editor";
import { EmailBannerSettings } from "@/components/admin/email-banner-settings";
import { GymPromoSettings } from "@/components/admin/gym-promo-settings";
import { HomeThemePicker } from "@/components/admin/home-theme-picker";
import { LuckyEnvelopeSettings } from "@/components/admin/lucky-envelope-settings";
import { MemberList } from "@/components/admin/member-list";
import { ResetOrders } from "@/components/admin/reset-orders";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getAppSettings } from "@/db/queries/settings";
import { getEnvelopeStats } from "@/db/queries/lucky-envelopes";
import { listAdminDiscounts } from "@/db/queries/admin-discounts";
import { getAllMembers } from "@/db/queries/users";
import { parseHomeTheme } from "@/lib/home-themes";
import { fallbackDisplayName } from "@/lib/display-name";
import { isAdminEmail, requireAdmin } from "@/lib/auth/session";
import { toBirthday } from "@/lib/birthday";
import { pageTitle } from "@/lib/app-name";
import { todayServiceDate } from "@/lib/date";
import { serverEnv } from "@/env";
import { getEmailBannerIds } from "@/lib/email/content";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Cài đặt") };

export default async function AdminSettingsPage() {
  await requireAdmin();
  const today = todayServiceDate();
  const [settings, [{ count: bookingCount }], members, envelopeStats, bannerIds, discounts] =
    await Promise.all([
      getAppSettings(),
      db.select({ count: sql<number>`count(*)::int` }).from(bookings),
      getAllMembers(),
      getEnvelopeStats(),
      getEmailBannerIds(),
      listAdminDiscounts(today),
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
        qrImageStamp={settings.hasQrImage ? String(settings.updatedAt.getTime()) : null}
      />

      <HomeThemePicker homeTheme={parseHomeTheme(settings.homeTheme)} />

      <GreetingEditor greetingMessage={settings.greetingMessage} />

      <EmailBannerSettings ids={bannerIds} />

      <LuckyEnvelopeSettings
        enabled={settings.luckyEnvelopeEnabled}
        opened={envelopeStats.opened}
        byPercent={envelopeStats.byPercent}
      />

      <AdminDiscountSettings
        today={today}
        members={members.map((member) => ({
          id: member.id,
          name: member.displayName || fallbackDisplayName(member.email),
        }))}
        discounts={discounts.map((discount) => ({
          id: discount.id,
          name: discount.displayName || fallbackDisplayName(discount.email),
          serviceDate: discount.serviceDate,
          percent: discount.percent,
          note: discount.note,
        }))}
      />

      {serverEnv.gymTimeUrl && (
        <GymPromoSettings
          dialogEnabled={settings.gymPromoEnabled}
          bannerEnabled={settings.gymBannerEnabled}
        />
      )}

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
