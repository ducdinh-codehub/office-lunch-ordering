"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { setNoticeEmails } from "@/app/(app)/me/profile/actions";

/** The diner's switch for event emails. Billing reminders are not covered. */
export function NoticeEmailsCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    startTransition(async () => {
      const result = await setNoticeEmails({ enabled: next });
      if (result.ok) {
        toast.success(next ? "Đã bật email thông báo." : "Đã tắt email thông báo.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="size-4" />
          Email thông báo
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground min-w-0 flex-1 basis-60 text-sm">
          {enabled
            ? "Bạn đang nhận email thông báo sự kiện từ quản lý."
            : "Bạn đã tắt email thông báo sự kiện."}{" "}
          Email nhắc thanh toán vẫn được gửi khi bạn còn nợ.
        </p>
        <Button variant="outline" disabled={isPending} onClick={() => save(!enabled)}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {enabled ? "Tắt email thông báo" : "Bật email thông báo"}
        </Button>
      </CardContent>
    </Card>
  );
}
