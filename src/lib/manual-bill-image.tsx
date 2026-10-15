import "server-only";

import { ImageResponse } from "next/og";

import type { ManualBillDetail } from "@/db/queries/manual-bills";
import type { PaymentState } from "@/db/queries/payments";
import { APP_SHORT_NAME } from "@/lib/app-name";
import { COLOR, ManualBillRows, loadBillFonts, manualBillRowsHeight } from "@/lib/bill-image-parts";
import { formatInstant, formatServiceDate, type ServiceDate } from "@/lib/date";

/*
 * Hand-written bills on their own as a PNG — the per-row download on Đơn hàng.
 * The day bill draws the same rows below its diners.
 */

const WIDTH = 900;
const PAD = 40;

export async function renderManualBillsImage({
  date,
  bills,
  states,
}: {
  date: ServiceDate;
  bills: ManualBillDetail[];
  states: Map<string, PaymentState>;
}): Promise<ImageResponse> {
  const height =
    PAD +
    80 + // title, date
    20 +
    manualBillRowsHeight(bills) +
    56 + // footer
    PAD;

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.5 }}>Hóa đơn riêng</div>
          <div style={{ fontSize: 17, color: COLOR.muted, marginTop: 4 }}>
            {formatServiceDate(date)}
          </div>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, color: COLOR.accent }}>{APP_SHORT_NAME}</div>
      </div>

      <ManualBillRows bills={bills} states={states} />

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
