import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentRoster, type RosterRowData } from "@/components/admin/payment-roster";
import { PendingClaims } from "@/components/admin/pending-claims";
import { getPaymentRoster, getPendingClaims } from "@/db/queries/payments";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatServiceDate,
  isServiceDate,
  monthBounds,
  shiftServiceDate,
  todayServiceDate,
} from "@/lib/date";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bảng thu tiền · Lunch Time" };

type Range = { from: string; to: string; label: string };

function resolveRange(from?: string, to?: string): Range {
  const today = todayServiceDate();
  if (isServiceDate(from) && isServiceDate(to) && from <= to) {
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
  await requireAdmin();
  const { from, to } = await searchParams;
  const range = resolveRange(from, to);
  const today = todayServiceDate();

  const [{ rows, dates }, claims] = await Promise.all([
    getPaymentRoster(range.from, range.to),
    getPendingClaims(),
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

  const lastMonth = monthBounds(shiftServiceDate(monthBounds(today).start, -1));
  const thisMonth = monthBounds(today);
  const lastWeek = { start: shiftServiceDate(today, -6), end: today };

  const presets: Array<{ label: string; from: string; to: string }> = [
    { label: "7 ngày qua", from: lastWeek.start, to: lastWeek.end },
    { label: "Tháng này", from: thisMonth.start, to: thisMonth.end },
    { label: "Tháng trước", from: lastMonth.start, to: lastMonth.end },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bảng thu tiền</h1>
        <p className="text-muted-foreground text-sm">{range.label}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const isActive = preset.from === range.from && preset.to === range.to;
          return (
            <LinkButton
              key={preset.label}
              href={`/admin/payments?from=${preset.from}&to=${preset.to}`}
              size="sm"
              variant={isActive ? "default" : "outline"}
            >
              {preset.label}
            </LinkButton>
          );
        })}
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
