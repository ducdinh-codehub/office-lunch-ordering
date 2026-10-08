import { ManualBillEditor } from "@/components/admin/manual-bill-editor";
import { listManualBills } from "@/db/queries/manual-bills";
import { getAllMembers } from "@/db/queries/users";
import { requireAdmin } from "@/lib/auth/session";
import { shiftServiceDate, todayServiceDate } from "@/lib/date";
import { fallbackDisplayName } from "@/lib/display-name";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Hoá đơn riêng") };

/** How far back the list goes. Anything dated later is listed too, typos included. */
const LIST_LOOKBACK_DAYS = 60;

export default async function AdminBillsPage() {
  await requireAdmin();
  const today = todayServiceDate();
  const [members, bills] = await Promise.all([
    getAllMembers(),
    listManualBills({
      from: shiftServiceDate(today, -LIST_LOOKBACK_DAYS),
      to: "9999-12-31",
    }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hoá đơn riêng</h1>
        <p className="text-muted-foreground text-sm">
          Ghi hoá đơn cho một người bằng tay — món và giá tự nhập. Hoá đơn cộng vào tiền của ngày
          đó, người đó thấy ở Đơn của tôi và trả cùng mã QR.
        </p>
      </div>

      <ManualBillEditor
        today={today}
        lookbackDays={LIST_LOOKBACK_DAYS}
        members={members.map((member) => ({
          id: member.id,
          name: member.displayName || fallbackDisplayName(member.email),
          email: member.email,
        }))}
        bills={bills.map((bill) => ({
          id: bill.id,
          name: bill.displayName || fallbackDisplayName(bill.email),
          email: bill.email,
          serviceDate: bill.serviceDate,
          serviceTime: bill.serviceTime,
          title: bill.title,
          items: bill.items,
          totalVnd: bill.totalVnd,
        }))}
      />
    </div>
  );
}
