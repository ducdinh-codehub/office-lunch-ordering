"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createEmailJob, sendTestEmailToMe } from "@/app/(app)/admin/emails/actions";
import { EmailEditor } from "@/components/admin/email-editor";
import { SUBJECT_MAX } from "@/lib/email/limits";
import { REPEAT_LABEL } from "@/lib/email/schedule";
import type { EmailKind, EmailRepeat } from "@/db/schema";

export type EmailMember = {
  id: string;
  name: string;
  email: string;
  noticeEmailsEnabled: boolean;
};

type Audience = "everyone" | "selected";
type Mode = "now" | "schedule";

const KIND_LABEL: Record<EmailKind, string> = { billing: "Nhắc nợ", notice: "Thông báo" };

/** Base UI's Select shows the raw value in its trigger unless given the labels. */
const REPEAT_ITEMS = (Object.keys(REPEAT_LABEL) as EmailRepeat[]).map((value) => ({
  value,
  label: REPEAT_LABEL[value],
}));

function audienceItems(kind: EmailKind) {
  return [
    { value: "everyone", label: kind === "billing" ? "Mọi người đang nợ" : "Tất cả mọi người" },
    { value: "selected", label: "Chọn người nhận" },
  ];
}

/**
 * Writes a billing or notice email and sends it now or on a schedule.
 *
 * Sending is confirmed inline first — an email to the whole office cannot be
 * taken back.
 */
export function EmailComposer({
  members,
  defaultScheduleAt,
}: {
  members: EmailMember[];
  /** A `datetime-local` value in Vietnam time — tomorrow morning. */
  defaultScheduleAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<EmailKind>("billing");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // Bumped after sending, to start the editor over empty.
  const [editorKey, setEditorKey] = useState(0);
  const [banners, setBanners] = useState({ header: true, footer: true });
  const [audience, setAudience] = useState<Audience>("everyone");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("now");
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleAt);
  const [repeat, setRepeat] = useState<EmailRepeat>("none");
  const [confirming, setConfirming] = useState(false);

  const isBilling = kind === "billing";
  const message = { kind, subject, body };

  function toggle(id: string) {
    setConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sendTest() {
    startTransition(async () => {
      const result = await sendTestEmailToMe({ message, banners });
      if (result.ok) toast.success("Đã gửi email thử vào hộp thư của bạn.");
      else toast.error(result.error);
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await createEmailJob({
        message,
        banners,
        recipients: { audience, recipientUserIds: [...selected] },
        when: mode === "now" ? { mode } : { mode, at: scheduleAt, repeat },
      });
      setConfirming(false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const summary = result.data?.summary;
      if (summary) {
        const parts = [`Đã gửi ${summary.sent} email`];
        if (summary.failed) parts.push(`${summary.failed} lỗi`);
        if (summary.skipped && isBilling) parts.push(`${summary.skipped} người không nợ`);
        (summary.failed ? toast.warning : toast.success)(`${parts.join(", ")}.`);
      } else {
        toast.success("Đã lên lịch.");
      }
      setSubject("");
      setBody("");
      setEditorKey((key) => key + 1);
      setSelected(new Set());
      router.refresh();
    });
  }

  const audienceText =
    audience === "selected"
      ? `${selected.size} người đã chọn`
      : isBilling
        ? "mọi người đang nợ"
        : "tất cả mọi người";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Soạn email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>Loại email</Label>
          <Tabs
            value={kind}
            onValueChange={(value) => {
              setKind(value as EmailKind);
              setConfirming(false);
            }}
          >
            <TabsList>
              <TabsTrigger value="billing">{KIND_LABEL.billing}</TabsTrigger>
              <TabsTrigger value="notice">{KIND_LABEL.notice}</TabsTrigger>
            </TabsList>
          </Tabs>
          <p className="text-muted-foreground text-xs">
            {isBilling
              ? "Mỗi người nhận danh sách ngày chưa trả và tổng số tiền của riêng họ, tính lúc gửi. Ai không nợ sẽ không nhận."
              : "Cùng một nội dung cho mọi người nhận — ví dụ thông báo sự kiện. Người đã tắt email thông báo sẽ không nhận."}
          </p>
        </div>

        {!isBilling && (
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Tiêu đề</Label>
            <Input
              id="email-subject"
              value={subject}
              maxLength={SUBJECT_MAX}
              placeholder="VD: Liên hoan cuối tháng chiều thứ Sáu"
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label>{isBilling ? "Lời nhắn thêm (tuỳ chọn)" : "Nội dung"}</Label>
          <EmailEditor
            key={editorKey}
            onChange={setBody}
            placeholder="Viết nội dung email… Có thể dán hoặc kéo ảnh vào đây."
            minHeight={isBilling ? 100 : 200}
          />
        </div>

        <div className="space-y-2">
          <Label>Banner PTPM3</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["header", "Banner đầu email"],
                ["footer", "Banner cuối email"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={banners[key]}
                  onCheckedChange={(checked) =>
                    setBanners((current) => ({ ...current, [key]: checked === true }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Người nhận</Label>
          <Select
            items={audienceItems(kind)}
            value={audience}
            onValueChange={(value) => {
              setAudience((value ?? "everyone") as Audience);
              setConfirming(false);
            }}
          >
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {audienceItems(kind).map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {audience === "selected" && (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
              {members.map((member) => {
                const optedOut = !isBilling && !member.noticeEmailsEnabled;
                return (
                  <label
                    key={member.id}
                    className="hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5"
                  >
                    <Checkbox
                      checked={selected.has(member.id)}
                      onCheckedChange={() => toggle(member.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{member.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {member.email}
                        {optedOut && " · đã tắt email thông báo"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Thời gian gửi</Label>
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as Mode);
              setConfirming(false);
            }}
          >
            <TabsList>
              <TabsTrigger value="now">Gửi ngay</TabsTrigger>
              <TabsTrigger value="schedule">Hẹn giờ</TabsTrigger>
            </TabsList>
          </Tabs>

          {mode === "schedule" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="email-at" className="text-muted-foreground text-xs">
                  Lần gửi đầu tiên (giờ Việt Nam)
                </Label>
                <Input
                  id="email-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-muted-foreground text-xs">Lặp lại</Label>
                <Select
                  items={REPEAT_ITEMS}
                  value={repeat}
                  onValueChange={(value) => setRepeat((value ?? "none") as EmailRepeat)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPEAT_ITEMS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-muted-foreground text-xs sm:col-span-2">
                Email hẹn giờ được gửi trong vòng khoảng 5 phút sau thời điểm đã chọn.
              </p>
            </div>
          )}
        </div>

        {confirming ? (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-sm text-amber-900 dark:text-amber-200">
              {mode === "now" ? "Gửi ngay" : "Lên lịch gửi"} email{" "}
              <strong>{KIND_LABEL[kind].toLowerCase()}</strong> cho <strong>{audienceText}</strong>
              {mode === "schedule" && repeat !== "none" && ` — ${REPEAT_LABEL[repeat].toLowerCase()}`}
              ?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button disabled={isPending} onClick={submit}>
                {isPending && <Loader2 className="size-4 animate-spin" />}
                {mode === "now" ? "Gửi" : "Lên lịch"}
              </Button>
              <Button variant="outline" disabled={isPending} onClick={() => setConfirming(false)}>
                Thôi
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={
                isPending ||
                (audience === "selected" && selected.size === 0) ||
                (!isBilling && (!subject.trim() || !body))
              }
              onClick={() => setConfirming(true)}
            >
              <Send className="size-4" />
              {mode === "now" ? "Gửi ngay" : "Lên lịch"}
            </Button>
            <Button variant="outline" disabled={isPending} onClick={sendTest}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Gửi thử cho tôi
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
