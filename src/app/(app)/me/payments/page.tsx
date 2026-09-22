import { SettleUp } from "@/components/payments/settle-up";
import { getUserLedger } from "@/db/queries/payments";
import { getAppSettings } from "@/db/queries/settings";
import { requireUser } from "@/lib/auth/session";
import { shiftServiceDate, todayServiceDate } from "@/lib/date";
import { buildTransferMemo, buildVietQrUrl, isBankAccountConfigured } from "@/lib/vietqr";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Thanh toán") };

export default async function MyPaymentsPage() {
  const user = await requireUser();
  const today = todayServiceDate();

  const [ledger, settings] = await Promise.all([
    getUserLedger(user.id, shiftServiceDate(today, -180), today),
    getAppSettings(),
  ]);

  const bankConfigured = isBankAccountConfigured(settings);
  const bank = bankConfigured
    ? {
        bankCode: settings.bankCode,
        bankAccountNo: settings.bankAccountNo,
        bankAccountName: settings.bankAccountName,
        qrTemplate: settings.qrTemplate,
      }
    : null;

  // Built without an amount here; the client appends the amount as the selection
  // changes, so the QR always matches what the user actually ticked.
  const qrUrlBase = bank ? buildVietQrUrl(bank) : null;

  // The uploaded photo only stands in when VietQR cannot be built — it is static,
  // so it carries neither the amount nor the memo.
  const uploadedQrUrl =
    !qrUrlBase && settings.qrImageData
      ? `/api/bank-qr?v=${settings.updatedAt.getTime()}`
      : null;
  const memoBase = buildTransferMemo({ email: user.email, displayName: user.displayName });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Thanh toán</h1>
        <p className="text-muted-foreground text-sm">
          Chọn những ngày bạn muốn trả, quét mã, rồi báo là đã chuyển.
        </p>
      </div>

      <SettleUp
        ledger={ledger}
        bank={bank}
        memoBase={memoBase}
        qrUrlBase={qrUrlBase}
        uploadedQrUrl={uploadedQrUrl}
        bankAccountName={settings.bankAccountName}
      />
    </div>
  );
}
