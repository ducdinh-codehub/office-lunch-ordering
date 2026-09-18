"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  removeBankQr,
  updateAppSettings,
  uploadBankQr,
} from "@/app/(app)/admin/settings/actions";

export type SettingsFormProps = {
  bankCode: string;
  bankAccountNo: string;
  bankAccountName: string;
  qrTemplate: string;
  defaultShipFeeVnd: number;
  /** Cache-busting stamp, or null when nothing has been uploaded. */
  qrImageStamp: string | null;
};

export function SettingsForm(props: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [bankCode, setBankCode] = useState(props.bankCode);
  const [bankAccountNo, setBankAccountNo] = useState(props.bankAccountNo);
  const [bankAccountName, setBankAccountName] = useState(props.bankAccountName);
  const [qrTemplate, setQrTemplate] = useState(props.qrTemplate || "compact2");
  const [defaultShipFee, setDefaultShipFee] = useState(String(props.defaultShipFeeVnd || ""));
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUpload(file: File | undefined) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      const result = await uploadBankQr(body);
      if (result.ok) {
        toast.success("Đã tải ảnh mã QR lên.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeBankQr();
      if (result.ok) {
        toast.success("Đã xoá ảnh mã QR.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const previewUrl =
    bankCode && bankAccountNo
      ? `https://img.vietqr.io/image/${bankCode}-${bankAccountNo}-${qrTemplate}.png?amount=45000&addInfo=LUNCH%20PREVIEW&accountName=${encodeURIComponent(bankAccountName)}`
      : null;

  function handleSave() {
    startTransition(async () => {
      const result = await updateAppSettings({
        bankCode,
        bankAccountNo,
        bankAccountName,
        qrTemplate,
        defaultShipFeeVnd: Number(defaultShipFee.replace(/[^\d]/g, "")) || 0,
      });
      if (result.ok) {
        toast.success("Đã lưu cài đặt.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_300px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tài khoản ngân hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bank-code">Mã ngân hàng</Label>
            <Input
              id="bank-code"
              value={bankCode}
              placeholder="VCB"
              onChange={(event) => setBankCode(event.target.value.toUpperCase())}
            />
            <p className="text-muted-foreground text-xs">
              Mã viết tắt hoặc BIN lấy từ{" "}
              <a
                href="https://api.vietqr.io/v2/banks"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                api.vietqr.io/v2/banks
              </a>{" "}
              — ví dụ VCB, TCB, MB, ACB, BIDV.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-no">Số tài khoản</Label>
            <Input
              id="account-no"
              inputMode="numeric"
              value={bankAccountNo}
              placeholder="0123456789"
              onChange={(event) => setBankAccountNo(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="account-name">Tên chủ tài khoản</Label>
            <Input
              id="account-name"
              value={bankAccountName}
              placeholder="NGUYEN VAN A"
              onChange={(event) => setBankAccountName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qr-template">Kiểu mã QR</Label>
            <Select
              value={qrTemplate}
              onValueChange={(value) => setQrTemplate(value ?? "compact2")}
            >
              <SelectTrigger id="qr-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compact2">Gọn, có số tiền (khuyên dùng)</SelectItem>
                <SelectItem value="compact">Gọn</SelectItem>
                <SelectItem value="qr_only">Chỉ mã QR</SelectItem>
                <SelectItem value="print">Bản in</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <Label htmlFor="ship-fee">Phí ship mặc định (VND)</Label>
            <Input
              id="ship-fee"
              inputMode="numeric"
              value={defaultShipFee}
              placeholder="30000"
              onChange={(event) => setDefaultShipFee(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Điền sẵn cho mỗi ngày mới. Phí của cả đơn, chia đều cho những người đặt hôm đó —
              sửa lại được cho từng ngày ở trang Thực đơn.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu cài đặt
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Xem trước</CardTitle>
        </CardHeader>
        <CardContent>
          {previewUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Xem trước mã VietQR"
                className="w-full rounded-lg border"
                width={260}
                height={340}
              />
              <p className="text-muted-foreground mt-2 text-xs">
                Mẫu cho 45.000 ₫. Nếu ảnh không hiện, mã ngân hàng hoặc số tài khoản
                đang sai.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Nhập mã ngân hàng và số tài khoản để xem mã QR.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Ảnh mã QR tự tải lên</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Nếu ngân hàng của bạn không có trên VietQR, hãy tải ảnh mã QR chụp từ app ngân hàng.
            Ảnh này chỉ được dùng khi chưa điền mã ngân hàng và số tài khoản ở trên.
          </p>
          <p className="text-muted-foreground text-sm">
            Lưu ý: ảnh tĩnh không kèm được số tiền và nội dung chuyển khoản, nên mọi người sẽ
            phải tự nhập. Dùng VietQR vẫn tiện hơn nếu ngân hàng của bạn được hỗ trợ.
          </p>

          <div className="flex flex-wrap items-start gap-4">
            {props.qrImageStamp && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/bank-qr?v=${props.qrImageStamp}`}
                alt="Mã QR đã tải lên"
                className="w-40 rounded-lg border"
              />
            )}
            <div className="space-y-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isPending}
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />
              <p className="text-muted-foreground text-xs">PNG, JPG hoặc WEBP, tối đa 1 MB.</p>
              {props.qrImageStamp && (
                <Button variant="outline" size="sm" disabled={isPending} onClick={handleRemove}>
                  Xoá ảnh
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
