import "server-only";

import { ImageResponse } from "next/og";

import { APP_SHORT_NAME } from "@/lib/app-name";
import {
  COLOR,
  ManualBillRows,
  STATE,
  SectionTitle,
  lines,
  loadBillFonts,
  manualBillRowsHeight,
} from "@/lib/bill-image-parts";
import type { DayBill, DayBillDiner } from "@/lib/day-bill";
import { formatInstant, formatServiceDate } from "@/lib/date";
import { KITCHEN_SECTIONS } from "@/lib/kitchen-bill";
import { formatVnd } from "@/lib/money";

/*
 * The day's bill drawn as a PNG, for pasting into the group chat. Rendered by
 * Satori (next/og): flexbox only, inline styles, and every element with more
 * than one child must say `display: flex`.
 *
 * Satori has no text measurement to hand back, so the canvas height is
 * estimated from the content with generous per-line allowances. Too tall leaves
 * white space at the bottom; too short would crop rows — so the estimates lean
 * long.
 */

const WIDTH = 900;
const PAD = 40;

// Characters per line before wrapping, rounded down from the real widths so a
// wrapped line is always budgeted for.
const DISH_CHARS_PER_LINE = 62;
const KITCHEN_CHARS_PER_LINE = 80;

function dinerHeight(diner: DayBillDiner) {
  const dishLines = diner.dishes.length ? lines(diner.dishes.join(", "), DISH_CHARS_PER_LINE) : 0;
  const noteLines = diner.notes.length ? lines(diner.notes.join("; "), DISH_CHARS_PER_LINE) : 0;
  return 22 + (dishLines + noteLines) * 21 + 22;
}

export async function renderDayBillImage(bill: DayBill): Promise<ImageResponse> {
  const { kitchen, diners, manualBills } = bill;

  const setSections = KITCHEN_SECTIONS.filter(({ category }) =>
    ["main", "side", "veg"].includes(category),
  )
    .map(({ category, label }) => ({
      label,
      text: kitchen.ordered
        .filter((line) => line.category === category)
        .map((line) => `${line.itemName} ×${line.totalQuantity}`)
        .join(", "),
    }))
    .filter((section) => section.text);
  const paidLines = kitchen.ordered.filter(
    (line) => line.category === "addon" || line.category === "drink",
  );
  const moneyRows = kitchen.setGroups.length + paidLines.length + (kitchen.shipFeeVnd > 0 ? 1 : 0);

  // Calibrated against rendered bills: each term is what that block measured
  // plus a few pixels, so a long day is never cropped.
  const height =
    PAD +
    150 + // title, date, stats
    (diners.length === 0
      ? 110
      : 58 + diners.reduce((total, diner) => total + dinerHeight(diner), 0) + 50) +
    (manualBills.length === 0 ? 0 : 58 + manualBillRowsHeight(manualBills)) +
    (kitchen.ordered.length === 0
      ? 0
      : 58 +
        setSections.reduce(
          (total, s) => total + lines(s.text, KITCHEN_CHARS_PER_LINE) * 24 + 12,
          0,
        ) +
        16 +
        moneyRows * 32 +
        54) +
    56 + // footer
    PAD;

  const headcount = diners.length;
  const setCount = kitchen.setGroups.reduce((total, group) => total + group.count, 0);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: PAD,
        backgroundColor: "#ffffff",
        color: COLOR.ink,
        fontFamily: "Be Vietnam Pro",
        fontSize: 15,
      }}
    >
      {/* Title */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>
            {bill.slot === "afternoon" ? "Hóa đơn tiệc chiều" : "Hóa đơn cơm trưa"}
          </div>
          <div style={{ fontSize: 17, color: COLOR.muted, marginTop: 4 }}>
            {formatServiceDate(bill.date)}
          </div>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: COLOR.accent }}>{APP_SHORT_NAME}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        {[
          { label: "Số suất", value: String(setCount) },
          { label: "Số người", value: String(headcount) },
          { label: "Tổng tiền quán", value: formatVnd(kitchen.totalVnd) },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "10px 16px",
              borderRadius: 12,
              backgroundColor: COLOR.soft,
            }}
          >
            <div style={{ fontSize: 13, color: COLOR.muted }}>{stat.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Per person */}
      <SectionTitle>Từng người</SectionTitle>
      {diners.length === 0 ? (
        <div style={{ display: "flex", color: COLOR.muted, padding: "24px 0" }}>
          Chưa ai đặt món cho ngày này.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {diners.map((diner, index) => (
            <div
              key={index}
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
                <div style={{ fontWeight: 600, fontSize: 16 }}>{diner.name}</div>
                {diner.dishes.length > 0 && (
                  <div
                    style={{ display: "flex", color: COLOR.muted, fontSize: 14, lineHeight: 1.5 }}
                  >
                    {diner.dishes.join(", ")}
                  </div>
                )}
                {diner.notes.length > 0 && (
                  <div
                    style={{ display: "flex", color: COLOR.accent, fontSize: 14, lineHeight: 1.5 }}
                  >
                    Ghi chú: {diner.notes.join("; ")}
                  </div>
                )}
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
                {formatVnd(diner.totalVnd)}
              </div>
              <div style={{ display: "flex", width: 130, justifyContent: "flex-end" }}>
                {diner.state ? (
                  <div
                    style={{
                      display: "flex",
                      padding: "2px 10px",
                      borderRadius: 999,
                      fontSize: 13,
                      backgroundColor: STATE[diner.state].bg,
                      color: STATE[diner.state].fg,
                    }}
                  >
                    {STATE[diner.state].label}
                  </div>
                ) : (
                  <div style={{ display: "flex", fontSize: 13, color: COLOR.muted }}>
                    Chưa đủ suất
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Same columns as a diner row, so the total sits under the amounts. */}
          <div style={{ display: "flex", gap: 16, paddingTop: 14, fontWeight: 600, fontSize: 17 }}>
            <div style={{ display: "flex", width: 28 }} />
            <div style={{ display: "flex", flex: 1 }}>Tổng mọi người</div>
            <div style={{ display: "flex", width: 130, justifyContent: "flex-end" }}>
              {formatVnd(bill.dinersTotalVnd)}
            </div>
            <div style={{ display: "flex", width: 130 }} />
          </div>
        </div>
      )}

      {/* The date's hand-written bills — apart from the sitting, never in its totals. */}
      {manualBills.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionTitle>Hóa đơn riêng · cả ngày</SectionTitle>
          <ManualBillRows bills={manualBills} states={bill.manualStates} />
        </div>
      )}

      {/* The quán's side */}
      {kitchen.ordered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SectionTitle>Đơn gửi quán</SectionTitle>
          {setSections.map((section) => (
            <div key={section.label} style={{ display: "flex", marginBottom: 12, lineHeight: 1.5 }}>
              <div style={{ display: "flex", width: 110, color: COLOR.muted, flexShrink: 0 }}>
                {section.label}
              </div>
              <div style={{ display: "flex", flex: 1 }}>{section.text}</div>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 4,
              paddingTop: 12,
              borderTop: `1px solid ${COLOR.line}`,
            }}
          >
            {kitchen.setGroups.map((group) => (
              <MoneyRow
                key={`set-${group.priceVnd}`}
                label={`Suất cơm × ${group.count}`}
                detail={formatVnd(group.priceVnd)}
                amount={group.count * group.priceVnd}
              />
            ))}
            {paidLines.map((line) => (
              <MoneyRow
                key={line.menuItemId}
                label={`${line.itemName} × ${line.totalQuantity}`}
                detail={formatVnd(line.priceVnd)}
                amount={line.totalQuantity * line.priceVnd}
              />
            ))}
            {kitchen.shipFeeVnd > 0 && <MoneyRow label="Phí ship" amount={kitchen.shipFeeVnd} />}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                paddingTop: 12,
                borderTop: `2px solid ${COLOR.ink}`,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              <div>Tổng tiền quán</div>
              <div>{formatVnd(kitchen.totalVnd)}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", marginTop: "auto", fontSize: 12, color: COLOR.muted }}>
        Xuất lúc {formatInstant(new Date())}
      </div>
    </div>,
    {
      width: WIDTH,
      height,
      fonts: await loadBillFonts(),
    },
  );
}

function MoneyRow({ label, detail, amount }: { label: string; detail?: string; amount: number }) {
  return (
    <div
      style={{ display: "flex", justifyContent: "space-between", height: 32, alignItems: "center" }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div>{label}</div>
        {detail && <div style={{ color: COLOR.muted }}>{detail}</div>}
      </div>
      <div>{formatVnd(amount)}</div>
    </div>
  );
}
