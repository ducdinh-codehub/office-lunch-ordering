import { GymTimePromoDialog } from "@/components/gym-time-promo-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { getAppSettings } from "@/db/queries/settings";
import { requireUser } from "@/lib/auth/session";
import { buildTransferMemo, buildVietQrUrl, isBankAccountConfigured } from "@/lib/vietqr";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, settings] = await Promise.all([requireUser(), getAppSettings()]);

  const account = {
    bankCode: settings.bankCode,
    bankAccountNo: settings.bankAccountNo,
    bankAccountName: settings.bankAccountName,
    qrTemplate: settings.qrTemplate,
  };
  // No amount: a coffee is mệnh giá tuỳ tâm, so the sender fills that in. The
  // memo names them and says CAFE, so a tip never reads as a lunch payment.
  const memo = buildTransferMemo({
    email: user.email,
    displayName: user.displayName,
    prefix: "CAFE",
  });

  const donate = isBankAccountConfigured(account)
    ? {
        qrUrl: buildVietQrUrl(account, { memo }),
        memo,
        accountName: settings.bankAccountName,
        accountNo: settings.bankAccountNo,
      }
    : settings.qrImageData
      ? {
          // The uploaded photo is static, so it carries neither amount nor memo
          // — the details below the QR are how the sender knows what to type.
          qrUrl: `/api/bank-qr?v=${settings.updatedAt.getTime()}`,
          memo,
          accountName: settings.bankAccountName,
          accountNo: settings.bankAccountNo,
        }
      : null;

  return (
    <AppShell user={user} donate={donate}>
      {children}
      <GymTimePromoDialog />
    </AppShell>
  );
}
