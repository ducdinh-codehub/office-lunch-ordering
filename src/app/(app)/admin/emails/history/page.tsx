import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { EmailRunList } from "@/components/admin/email-run-list";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { getEmailRunHistory } from "@/db/queries/emails";
import type { EmailRunTrigger } from "@/db/schema";
import { pageTitle } from "@/lib/app-name";
import { requireAdmin } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: pageTitle("Lịch sử gửi email") };

const PAGE_SIZE = 30;

/** The filter tabs, by the value they put in `?nguon=`. */
const SOURCES: Array<{ value: string | null; label: string; trigger?: EmailRunTrigger }> = [
  { value: null, label: "Tất cả" },
  { value: "hen-gio", label: "Hẹn giờ", trigger: "cron" },
  { value: "gui-ngay", label: "Gửi ngay", trigger: "now" },
];

function historyHref(source: string | null, page: number): string {
  const params = new URLSearchParams();
  if (source) params.set("nguon", source);
  if (page > 1) params.set("trang", String(page));
  const query = params.toString();
  return query ? `/admin/emails/history?${query}` : "/admin/emails/history";
}

export default async function EmailHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ nguon?: string; trang?: string }>;
}) {
  await requireAdmin();
  const { nguon, trang } = await searchParams;
  const source = SOURCES.find((item) => item.value === nguon) ?? SOURCES[0];
  const page = Math.max(1, Number.parseInt(trang ?? "1", 10) || 1);

  const { runs, total } = await getEmailRunHistory({
    trigger: source.trigger,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/admin/emails"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />
          Email
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Lịch sử gửi email</h1>
        <p className="text-muted-foreground text-sm">
          Mỗi lần một email được gửi — bấm “Gửi ngay”, hoặc đến giờ đã hẹn — kể cả những
          lần không ai cần nhận.
        </p>
      </div>

      <nav className="bg-muted inline-flex rounded-lg p-1 text-sm">
        {SOURCES.map((item) => (
          <Link
            key={item.label}
            href={historyHref(item.value, 1)}
            className={cn(
              "rounded-md px-3 py-1",
              item === source
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <Card>
        <CardContent>
          <EmailRunList
            runs={runs}
            empty={
              source.trigger === "cron" ? "Chưa có email hẹn giờ nào được gửi." : "Chưa gửi email nào."
            }
          />
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <LinkButton
            variant="outline"
            size="sm"
            href={historyHref(source.value, page - 1)}
            className={cn(page <= 1 && "pointer-events-none opacity-50")}
          >
            Mới hơn
          </LinkButton>
          <span className="text-muted-foreground text-sm tabular-nums">
            Trang {page}/{pages} · {total} lần gửi
          </span>
          <LinkButton
            variant="outline"
            size="sm"
            href={historyHref(source.value, page + 1)}
            className={cn(page >= pages && "pointer-events-none opacity-50")}
          >
            Cũ hơn
          </LinkButton>
        </div>
      )}
    </div>
  );
}
