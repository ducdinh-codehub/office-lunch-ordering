"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateGreeting } from "@/app/(app)/admin/settings/actions";
import { GREETING_MAX_LENGTH } from "@/lib/greeting";

/** The wish on the home page. Saving it empty takes the banner down. */
export function GreetingEditor({ greetingMessage }: { greetingMessage: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState(greetingMessage);

  const unchanged = message.trim() === greetingMessage;

  function save(next: string) {
    startTransition(async () => {
      const result = await updateGreeting({ greetingMessage: next });
      if (result.ok) {
        setMessage(next.trim());
        toast.success(next.trim() ? "Đã lưu lời chúc." : "Đã gỡ lời chúc.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lời chúc trên trang chủ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Hiện thành một banner trên trang Hôm nay. Mọi người có thể đóng banner — khi bạn đổi lời
          chúc, banner sẽ hiện lại. Để trống để gỡ banner.
        </p>
        <div className="space-y-2">
          <Label htmlFor="greeting-message">Nội dung</Label>
          <Textarea
            id="greeting-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={GREETING_MAX_LENGTH}
            placeholder="VD: Chúc cả nhà Trung Thu đoàn viên, ấm áp và thật nhiều niềm vui! 🥮"
            className="min-h-20"
          />
          <p className="text-muted-foreground text-right text-xs tabular-nums">
            {message.length}/{GREETING_MAX_LENGTH}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={unchanged || isPending} onClick={() => save(message)}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu lời chúc
          </Button>
          {greetingMessage && (
            <Button variant="outline" disabled={isPending} onClick={() => save("")}>
              Gỡ banner
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
