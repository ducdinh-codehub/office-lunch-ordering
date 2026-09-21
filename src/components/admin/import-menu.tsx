"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ClipboardPaste, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { importMenuText } from "@/app/(app)/admin/menu/actions";
import { parseMenuText } from "@/lib/menu-import";
import { formatVnd } from "@/lib/money";
import type { ServiceDate } from "@/lib/date";

const CATEGORY_LABEL = {
  main: "Món chính",
  side: "Món phụ",
  veg: "Món rau",
  addon: "Gọi thêm",
  drink: "Đồ uống",
} as const;

/**
 * Paste the restaurant's message, see what was understood, then import.
 *
 * The preview runs the same parser the action does, so what the admin checks is
 * exactly what gets written.
 */
export function ImportMenu({ serviceDate }: { serviceDate: ServiceDate }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const parsed = useMemo(() => (text.trim() ? parseMenuText(text) : null), [text]);

  function handleImport() {
    startTransition(async () => {
      const result = await importMenuText({ serviceDate, text });
      if (result.ok) {
        const { imported = 0, missingPrice = 0 } = result.data ?? {};
        toast.success(
          missingPrice > 0
            ? `Đã nhập ${imported} món — ${missingPrice} món chưa có giá, hãy sửa bên dưới.`
            : `Đã nhập ${imported} món.`,
        );
        setText("");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ClipboardPaste className="size-4" />
        Nhập thực đơn từ tin nhắn
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nhập thực đơn từ tin nhắn</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          autoFocus
          placeholder={"Dán nguyên tin nhắn của quán vào đây…\n\n🥓🥩 Món Chính:\nThịt Nấu Giả Cầy\n…"}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border p-3 font-mono text-xs focus-visible:ring-2 focus-visible:outline-none"
        />

        {parsed && (
          <div className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {(Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map(
                (category) => {
                  const count = parsed.items.filter((i) => i.category === category).length;
                  if (count === 0) return null;
                  return (
                    <Badge key={category} variant="secondary">
                      {CATEGORY_LABEL[category]} {count}
                    </Badge>
                  );
                },
              )}
              {parsed.items.length === 0 && (
                <span className="text-destructive">Không nhận ra món nào.</span>
              )}
            </div>

            {parsed.missingPrice > 0 && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <TriangleAlert className="size-3.5" />
                {parsed.missingPrice} món tính tiền riêng chưa có giá — nhập xong sửa lại bên dưới.
              </p>
            )}

            {parsed.items.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <tbody>
                    {parsed.items.map((item, index) => (
                      <tr key={`${item.name}-${index}`} className="border-b last:border-0">
                        <td className="text-muted-foreground w-20 py-1.5 pl-2">
                          {CATEGORY_LABEL[item.category]}
                        </td>
                        <td className="py-1.5">{item.name}</td>
                        <td className="text-muted-foreground py-1.5 pr-2 text-right tabular-nums">
                          {item.priceVnd > 0 ? formatVnd(item.priceVnd) : ""}
                          {item.description ? ` / ${item.description}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <p className="text-muted-foreground text-xs">
          Nhập thực đơn sẽ thay thế toàn bộ món của ngày này.
        </p>

        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={isPending || !parsed || parsed.items.length === 0}
            onClick={handleImport}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Nhập {parsed?.items.length ?? 0} món
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setOpen(false);
              setText("");
            }}
          >
            Huỷ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
