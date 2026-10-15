import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ManualBillDetail } from "@/db/queries/manual-bills";
import type { PaymentState } from "@/db/queries/payments";
import { fallbackDisplayName } from "@/lib/display-name";
import { formatServiceTime } from "@/lib/manual-bill";
import { formatVnd } from "@/lib/money";

/*
 * What the bill images share: colours, fonts, and the hand-written bill rows,
 * which the day bill draws below its diners and the single-bill download draws
 * on their own. Satori rules apply — see `day-bill-image`.
 */

export const COLOR = {
  ink: "#18181b",
  muted: "#71717a",
  line: "#e4e4e7",
  soft: "#f4f4f5",
  accent: "#b45309",
};

export const STATE: Record<PaymentState, { label: string; bg: string; fg: string }> = {
  confirmed: { label: "Đã trả", bg: "#d1fae5", fg: "#047857" },
  pending: { label: "Chờ xác nhận", bg: "#fef3c7", fg: "#b45309" },
  rejected: { label: "Không tìm thấy", bg: "#fee2e2", fg: "#b91c1c" },
  unpaid: { label: "Chưa trả", bg: COLOR.soft, fg: COLOR.muted },
};

// Bundled rather than fetched: the default font has no Vietnamese diacritics.
// Read relative to the project root, which Next traces into the deployment
// (see outputFileTracingIncludes in next.config.ts).
const FONT_DIR = join(process.cwd(), "src/assets/fonts");
let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 600 }[]> | null = null;
export function loadBillFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "BeVietnamPro-Regular.ttf")).then((data) => ({
      name: "Be Vietnam Pro",
      data,
      weight: 400 as const,
    })),
    readFile(join(FONT_DIR, "BeVietnamPro-SemiBold.ttf")).then((data) => ({
      name: "Be Vietnam Pro",
      data,
      weight: 600 as const,
    })),
  ]);
  return fonts;
}

export const lines = (text: string, perLine: number) =>
  Math.max(1, Math.ceil(text.length / perLine));

export function SectionTitle({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        marginTop: 28,
        marginBottom: 10,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: "uppercase",
        color: COLOR.muted,
      }}
    >
      {children}
    </div>
  );
}

// The middle column is what is left of 900px after the number, amount and
// state columns; rounded down so a wrapped line is always budgeted for.
const ITEM_CHARS_PER_LINE = 50;

const itemText = (item: ManualBillDetail["items"][number]) =>
  `${item.name} × ${item.quantity} · ${formatVnd(item.lineTotalVnd)}`;

/** How tall `ManualBillRows` draws these bills, leaning long like every estimate here. */
export function manualBillRowsHeight(bills: ManualBillDetail[]) {
  const rows = bills.reduce((total, bill) => {
    const subtitle = bill.serviceTime || bill.title ? 22 : 0;
    const items = bill.items.reduce(
      (sum, item) => sum + lines(itemText(item), ITEM_CHARS_PER_LINE) * 22,
      0,
    );
    return total + 22 + 24 + subtitle + items + 26;
  }, 0);
  // the total row, and the note on discounts under it
  return rows + 50 + 40;
}

/**
 * One row per hand-written bill, a total, and a note that the amounts are
 * before the day's discounts — those come off the whole date, not a bill.
 */
export function ManualBillRows({
  bills,
  states,
}: {
  bills: ManualBillDetail[];
  /** The date's payment state per person — payment is per date. */
  states: Map<string, PaymentState>;
}) {
  const totalVnd = bills.reduce((total, bill) => total + bill.totalVnd, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {bills.map((bill, index) => {
        const state = states.get(bill.userId) ?? "unpaid";
        const subtitle = [formatServiceTime(bill.serviceTime), bill.title]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={bill.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              padding: "11px 0",
              borderBottom: `1px solid ${COLOR.line}`,
            }}
          >
            <div style={{ display: "flex", width: 28, color: COLOR.muted }}>{index + 1}</div>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>
                {bill.displayName ?? fallbackDisplayName(bill.email)}
              </div>
              {subtitle && (
                <div style={{ display: "flex", color: COLOR.accent, fontSize: 14 }}>{subtitle}</div>
              )}
              {bill.items.map((item, itemIndex) => (
                <div
                  key={itemIndex}
                  style={{ display: "flex", color: COLOR.muted, fontSize: 14, lineHeight: 1.5 }}
                >
                  {itemText(item)}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                width: 130,
                justifyContent: "flex-end",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              {formatVnd(bill.totalVnd)}
            </div>
            <div style={{ display: "flex", width: 130, justifyContent: "flex-end" }}>
              <div
                style={{
                  display: "flex",
                  padding: "2px 10px",
                  borderRadius: 999,
                  fontSize: 13,
                  backgroundColor: STATE[state].bg,
                  color: STATE[state].fg,
                }}
              >
                {STATE[state].label}
              </div>
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 16, paddingTop: 14, fontWeight: 600, fontSize: 17 }}>
        <div style={{ display: "flex", width: 28 }} />
        <div style={{ display: "flex", flex: 1 }}>Tổng hóa đơn riêng</div>
        <div style={{ display: "flex", width: 130, justifyContent: "flex-end" }}>
          {formatVnd(totalVnd)}
        </div>
        <div style={{ display: "flex", width: 130 }} />
      </div>
      <div style={{ display: "flex", marginTop: 14, fontSize: 13, color: COLOR.muted }}>
        Số tiền trước lì xì, sinh nhật và giảm giá — những khoản đó trừ vào tổng cả ngày.
      </div>
    </div>
  );
}
