"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Loader2, RotateCcw, Send } from "lucide-react";
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
import { cn } from "@/lib/utils";
import {
  createEmailJob,
  previewEmailHtml,
  sendTestEmailToMe,
} from "@/app/(app)/admin/emails/actions";
import { EmailEditor } from "@/components/admin/email-editor";
import { BILLING_PLACEHOLDERS, DEFAULT_BILLING_TEMPLATE } from "@/lib/email/billing-template";
import { SUBJECT_MAX } from "@/lib/email/limits";
import { formatVnd } from "@/lib/money";
import { REPEAT_LABEL } from "@/lib/email/schedule";
import type { Debtor } from "@/db/queries/payments";
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
  debtors,
  uploadedBanners,
  defaultScheduleAt,
}: {
  members: EmailMember[];
  /** Who owes right now — the billing tab's recipient list. */
  debtors: Debtor[];
  /** Which banners this deployment has uploaded at /admin/settings. */
  uploadedBanners: { header: boolean; billing: boolean; footer: boolean };
  /** A `datetime-local` value in Vietnam time — tomorrow morning. */
  defaultScheduleAt: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<EmailKind>("billing");
  const [subject, setSubject] = useState("");
  // Each tab keeps its own text: billing starts from the standard wording.
  const [bodies, setBodies] = useState<Record<EmailKind, string>>({
    billing: DEFAULT_BILLING_TEMPLATE,
    notice: "",
  });
  // Bumped to start the editor over from `bodies` — after sending, or a reset.
  const [editorKey, setEditorKey] = useState(0);
  const [banners, setBanners] = useState({ header: true, footer: true });
  // Nobody until chosen: "everyone" is a tick of its own, never a default,
  // so a test cannot reach the whole office by being left as it was.
  const [audience, setAudience] = useState<Audience>("selected");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("now");
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleAt);
  const [repeat, setRepeat] = useState<EmailRepeat>("none");
  const [confirming, setConfirming] = useState(false);

  const isBilling = kind === "billing";
  // A billing email opens with its own banner, or the general one — as sent.
  const bannerExists = {
    header: isBilling ? uploadedBanners.billing || uploadedBanners.header : uploadedBanners.header,
    footer: uploadedBanners.footer,
  };
  const body = bodies[kind];
  const message = { kind, subject, body };
  // Whose figures the preview uses: the first billing recipient ticked, or
  // the biggest debt when sending to everyone. A notice is the same for all.
  const sampleUserId = isBilling
    ? audience === "selected"
      ? (debtors.find((debtor) => selected.has(debtor.userId))?.userId ?? null)
      : (debtors[0]?.userId ?? null)
    : null;

  function setBody(html: string) {
    setBodies((current) => ({ ...current, [kind]: html }));
  }

  function resetBillingText() {
    setBodies((current) => ({ ...current, billing: DEFAULT_BILLING_TEMPLATE }));
    setEditorKey((key) => key + 1);
  }

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
      setBodies((current) => ({
        ...current,
        [kind]: kind === "billing" ? DEFAULT_BILLING_TEMPLATE : "",
      }));
      setEditorKey((key) => key + 1);
      setAudience("selected");
      setSelected(new Set());
      router.refresh();
    });
  }

  const audienceText =
    audience === "selected"
      ? `${selected.size} người đã chọn`
      : isBilling
        ? `mọi người đang nợ (hiện ${debtors.length} người)`
        : `tất cả mọi người (${members.filter((member) => member.noticeEmailsEnabled).length} người)`;
  // Named in the confirmation, so it is plain who is about to get it.
  const chosenNames =
    audience === "selected"
      ? (isBilling
          ? debtors.filter((debtor) => selected.has(debtor.userId)).map((debtor) => debtor.name)
          : members.filter((member) => selected.has(member.id)).map((member) => member.name))
      : [];

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
              // The two tabs pick from different lists; each starts with nobody.
              setAudience("selected");
              setSelected(new Set());
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

        {isBilling && (
          <DebtorPicker
            debtors={debtors}
            everyone={audience === "everyone"}
            selected={selected}
            onEveryone={(on) => {
              setConfirming(false);
              setAudience(on ? "everyone" : "selected");
              setSelected(new Set());
            }}
            onToggle={(id) => {
              if (audience === "everyone") {
                // Unticking one person out of "everyone" keeps the rest.
                setConfirming(false);
                setAudience("selected");
                setSelected(new Set(debtors.map((d) => d.userId).filter((other) => other !== id)));
              } else {
                toggle(id);
              }
            }}
          />
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>Nội dung</Label>
            {isBilling && body !== DEFAULT_BILLING_TEMPLATE && (
              <Button variant="ghost" size="sm" onClick={resetBillingText}>
                <RotateCcw className="size-3.5" />
                Về nội dung mặc định
              </Button>
            )}
          </div>
          <EmailEditor
            key={`${kind}:${editorKey}`}
            initialHtml={body}
            onChange={setBody}
            placeholder="Viết nội dung email… Có thể dán hoặc kéo ảnh vào đây."
            minHeight={200}
          />
          {isBilling && <PlaceholderLegend />}
        </div>

        <div className="space-y-2">
          <Label>Banner</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["header", "Banner đầu email"],
                ["footer", "Banner cuối email"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  bannerExists[key] ? "cursor-pointer" : "text-muted-foreground",
                )}
              >
                <Checkbox
                  checked={bannerExists[key] && banners[key]}
                  disabled={!bannerExists[key]}
                  onCheckedChange={(checked) =>
                    setBanners((current) => ({ ...current, [key]: checked === true }))
                  }
                />
                {label}
                {!bannerExists[key] && <span className="text-xs">(chưa tải lên)</span>}
              </label>
            ))}
          </div>
          {(!bannerExists.header || !bannerExists.footer) && (
            <p className="text-muted-foreground text-xs">
              Banner là ảnh của riêng bạn —{" "}
              <Link href="/admin/settings" className="underline underline-offset-4">
                tải lên ở Cài đặt
              </Link>
              . Chưa có thì email gửi không có ảnh.
            </p>
          )}
        </div>

        <EmailPreview
          kind={kind}
          subject={subject}
          body={body}
          banners={banners}
          sampleUserId={sampleUserId}
        />

        {!isBilling && (
          <div className="space-y-2">
            <Label>Người nhận</Label>
            <Select
              items={audienceItems(kind)}
              value={audience}
              onValueChange={(value) => {
                setAudience((value ?? "selected") as Audience);
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
        )}

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
            {chosenNames.length > 0 && (
              <p className="text-xs text-amber-900 dark:text-amber-200">
                {chosenNames.slice(0, 8).join(", ")}
                {chosenNames.length > 8 && ` và ${chosenNames.length - 8} người khác`}
              </p>
            )}
            {audience === "everyone" && mode === "schedule" && (
              <p className="text-xs text-amber-900 dark:text-amber-200">
                Người nhận được tính lúc gửi — ai {isBilling ? "nợ" : "tham gia"} sau khi lên lịch
                cũng sẽ nhận.
              </p>
            )}
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

/**
 * The billing tab's recipients: everyone who owes, with how much. Ticking
 * "everyone" sends to whoever owes at send time — a scheduled reminder then
 * reaches people who fall behind later; ticking names sends to those alone.
 */
function DebtorPicker({
  debtors,
  everyone,
  selected,
  onEveryone,
  onToggle,
}: {
  debtors: Debtor[];
  everyone: boolean;
  selected: Set<string>;
  onEveryone: (on: boolean) => void;
  onToggle: (id: string) => void;
}) {
  const total = debtors.reduce((sum, debtor) => sum + debtor.totalVnd, 0);
  return (
    <div className="space-y-1.5">
      <Label>Người chưa thanh toán</Label>
      {debtors.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border p-3 text-sm">Không có ai nợ</p>
      ) : (
        <div className="rounded-lg border">
          <label className="bg-muted/40 flex cursor-pointer items-center gap-3 border-b px-3 py-2">
            <Checkbox
              checked={everyone}
              onCheckedChange={(checked) => onEveryone(checked === true)}
            />
            <span className="flex-1 text-sm font-medium">
              Gửi cho tất cả ({debtors.length} người)
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatVnd(total)}</span>
          </label>
          <ul className="max-h-72 divide-y overflow-y-auto">
            {debtors.map((debtor) => (
              <li key={debtor.userId}>
                <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-3 px-3 py-2">
                  <Checkbox
                    checked={everyone || selected.has(debtor.userId)}
                    onCheckedChange={() => onToggle(debtor.userId)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{debtor.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {debtor.email}
                    </span>
                  </span>
                  <span className="text-right text-sm tabular-nums">
                    {formatVnd(debtor.totalVnd)}
                    <span className="text-muted-foreground block text-xs">
                      {debtor.days} ngày chưa trả
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {debtors.length > 0 && (
        <p className="text-muted-foreground text-xs">
          Số liệu lúc mở trang — email tính lại đúng lúc gửi, ai đã trả xong sẽ không nhận.
        </p>
      )}
    </div>
  );
}

/**
 * What each placeholder becomes. Clicking one copies it, to paste where it
 * should go — each person's own figure replaces it when the email is sent.
 */
function PlaceholderLegend() {
  return (
    <div className="text-muted-foreground space-y-1.5 text-xs">
      <p>Từ khoá được thay bằng số liệu của từng người lúc gửi — bấm để chép:</p>
      <div className="flex flex-wrap gap-1.5">
        {BILLING_PLACEHOLDERS.map((placeholder) => (
          <button
            key={placeholder.token}
            type="button"
            className="hover:bg-accent rounded-md border px-2 py-1 text-left"
            onClick={() => {
              navigator.clipboard.writeText(placeholder.token).then(
                () => toast.success(`Đã chép ${placeholder.token}`),
                () => toast.error("Không chép được — hãy gõ tay."),
              );
            }}
          >
            <code className="text-foreground font-mono">{placeholder.token}</code>{" "}
            {placeholder.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The email as it will arrive, banners and all, rendered by the same code
 * that sends it. Redrawn shortly after typing stops.
 */
function EmailPreview({
  kind,
  subject,
  body,
  banners,
  sampleUserId,
}: {
  kind: EmailKind;
  subject: string;
  body: string;
  banners: { header: boolean; footer: boolean };
  sampleUserId: string | null;
}) {
  const [preview, setPreview] = useState<{ subject: string; html: string; name: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await previewEmailHtml({
        message: { kind, subject, body },
        banners,
        sampleUserId,
      });
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setPreview(result.data!);
        setError(null);
      } else {
        setError(result.error);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, subject, body, banners, sampleUserId]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label>Xem trước</Label>
        {loading && <Loader2 className="text-muted-foreground size-3.5 animate-spin" />}
      </div>
      {preview && (
        <p className="text-muted-foreground text-xs">
          {kind === "billing" ? <>Như {preview.name} sẽ nhận · </> : null}
          Tiêu đề: <span className="text-foreground font-medium">{preview.subject || "—"}</span>
        </p>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
      {/* The email's own HTML, sanitised. No scripts run in the frame;
          same-origin only so uploaded pictures load for the admin. */}
      <iframe
        title="Xem trước email"
        srcDoc={preview?.html ?? ""}
        sandbox="allow-same-origin allow-popups"
        className="bg-muted/30 h-[640px] w-full rounded-lg border"
      />
    </div>
  );
}
