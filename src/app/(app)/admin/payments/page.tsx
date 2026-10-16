import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentRoster, type RosterRowData } from "@/components/admin/payment-roster";
import { PendingClaims } from "@/components/admin/pending-claims";
import { MonthPicker } from "@/components/admin/month-picker";
import { getBillableDates } from "@/db/queries/menu";
import { getPaymentRoster, getPendingClaims } from "@/db/queries/payments";
import { requireSection } from "@/lib/auth/session";
import {
  formatServiceDate,
  isServiceDate,
  monthBounds,
  shiftServiceDate,
  todayServiceDate,
} from "@/lib/date";
import { formatVnd } from "@/lib/money";
import { pageTitle } from "@/lib/app-name";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Bảng thu tiền") };

type Range = { from: string; to: string; label: string };

function resolveRange(from?: string, to?: string): Range {
  const today = todayServiceDate();
  if (isServiceDate(from) && isServiceDate(to) && from <= to) {
    const month = monthBounds(from);
    if (month.start === from && month.end === to) {
      const label =
        from === monthBounds(today).start
          ? "Tháng này"
          : `Tháng ${Number(from.slice(5, 7))}/${from.slice(0, 4)}`;
      return { from, to, label };
    }
    return { from, to, label: `${formatServiceDate(from)} → ${formatServiceDate(to)}` };
  }
  const month = monthBounds(today);
  return { from: month.start, to: month.end, label: "Tháng này" };
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireSection("payments");
  const { from, to } = await searchParams;
  const range = resolveRange(from, to);
  const today = todayServiceDate();

  const [{ rows, dates }, claims, billableDates] = await Promise.all([
    getPaymentRoster(range.from, range.to),
    getPendingClaims(),
    // Which months the picker dots: about a year back and a few months ahead.
    getBillableDates(shiftServiceDate(today, -400), shiftServiceDate(today, 100)),
  ]);

  // Maps don't survive the server → client boundary; flatten to plain objects.
  const rosterRows: RosterRowData[] = rows.map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
    cells: Object.fromEntries(row.cells),
    totalOwedVnd: row.totalOwedVnd,
    outstandingVnd: row.outstandingVnd,
    pendingVnd: row.pendingVnd,
    confirmedVnd: row.confirmedVnd,
    fullySettled: row.fullySettled,
  }));

  const totals = rosterRows.reduce(
    (acc, row) => ({
      billed: acc.billed + row.totalOwedVnd,
      collected: acc.collected + row.confirmedVnd,
      pending: acc.pending + row.pendingVnd,
      outstanding: acc.outstanding + row.outstandingVnd,
    }),
    { billed: 0, collected: 0, pending: 0, outstanding: 0 },
  );

  const thisMonth = monthBounds(today);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bảng thu tiền</h1>
        <p className="text-muted-foreground text-sm">{range.label}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <LinkButton
          href={`/admin/payments?from=${thisMonth.start}&to=${thisMonth.end}`}
          size="sm"
          variant={
            range.from === thisMonth.start && range.to === thisMonth.end ? "default" : "outline"
          }
        >
          Tháng này
        </LinkButton>
        <MonthPicker
          from={range.from}
          to={range.to}
          today={today}
          markedDates={billableDates}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Đã tính", value: totals.billed },
          { label: "Đã thu", value: totals.collected },
          { label: "Chờ kiểm tra", value: totals.pending },
          { label: "Còn nợ", value: totals.outstanding },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="mt-1 font-semibold tabular-nums">{formatVnd(stat.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <PendingClaims claims={claims} />

      <PaymentRoster rows={rosterRows} dates={dates} />
    </div>
  );
}
