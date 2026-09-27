"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateHomeTheme } from "@/app/(app)/admin/settings/actions";
import { HOME_THEMES, type HomeThemeSetting } from "@/lib/home-themes";
import { cn } from "@/lib/utils";

const options: {
  id: HomeThemeSetting;
  label: string;
  description: string;
  preview: string;
}[] = [
  {
    id: "none",
    label: "Mặc định",
    description: "Không có hình nền trang trí.",
    preview: "🍽️",
  },
  ...HOME_THEMES,
];

/** Applies on click — there is nothing else on the card to save alongside it. */
export function HomeThemePicker({ homeTheme }: { homeTheme: HomeThemeSetting }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState(homeTheme);
  const [pendingId, setPendingId] = useState<HomeThemeSetting | null>(null);

  function choose(id: HomeThemeSetting) {
    if (id === selected || isPending) return;
    const previous = selected;
    setSelected(id);
    setPendingId(id);
    startTransition(async () => {
      const result = await updateHomeTheme({ homeTheme: id });
      setPendingId(null);
      if (result.ok) {
        toast.success("Đã đổi giao diện trang chủ.");
        router.refresh();
      } else {
        setSelected(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Giao diện theo mùa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Hình nền cho các trang Hôm nay, Đơn của tôi và Thanh toán — mọi người đều thấy. Bật lại
          mỗi năm khi tới dịp.
        </p>
        <div
          role="radiogroup"
          aria-label="Giao diện theo mùa"
          className="grid gap-2 sm:grid-cols-2"
        >
          {options.map((option) => {
            const active = option.id === selected;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={isPending}
                onClick={() => choose(option.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-wait",
                  active ? "border-primary bg-accent" : "hover:bg-accent/60",
                )}
              >
                <span
                  aria-hidden
                  className="bg-muted grid size-10 shrink-0 place-items-center rounded-full text-xl"
                >
                  {option.preview}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="text-muted-foreground block text-xs">{option.description}</span>
                </span>
                {pendingId === option.id ? (
                  <Loader2 className="text-muted-foreground size-4 shrink-0 animate-spin" />
                ) : (
                  active && <Check className="size-4 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
