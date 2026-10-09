"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WelcomeContentBox } from "@/components/welcome/welcome-content-box";
import {
  removeWelcomeImage,
  setWelcomeImage,
  updateWelcomeScreen,
} from "@/app/(app)/admin/settings/actions";
import {
  WELCOME_BORDER_RADIUS_MAX,
  WELCOME_BORDER_STYLES,
  WELCOME_BORDER_WIDTH_MAX,
  WELCOME_BUTTON_CLASS,
  WELCOME_BUTTON_LABEL,
  WELCOME_MESSAGE_MAX,
  WELCOME_SCALE_MAX,
  WELCOME_SCALE_MIN,
  WELCOME_THEMES,
  WELCOME_TITLE_MAX,
  type WelcomeBorderStyle,
  type WelcomeThemeId,
} from "@/lib/welcome-screen";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SCHEDULE_LINK_LABEL,
  SCHEDULE_LINK_LABEL_MAX,
  WELCOME_SCHEDULE_MAX,
} from "@/lib/welcome-schedule";

export type WelcomeScreenValues = {
  enabled: boolean;
  theme: WelcomeThemeId;
  title: string;
  message: string;
  schedule: string;
  emailLinkLabel: string;
  textScale: number;
  imageScale: number;
  borderStyle: WelcomeBorderStyle;
  borderWidth: number;
  borderColor: string;
  borderRadius: number;
};

/** What the colour picker shows while the border follows the theme's colour. */
const PICKER_FALLBACK = "#f97316";

/**
 * The welcome screen before /login: the switch, the backdrop, what sits in
 * the middle and its frame. Everything but the picture is saved together with
 * one button, and the preview follows the form as it is typed. The picture
 * uploads on its own, like the email banners.
 */
export function WelcomeScreenSettings({
  initial,
  imageUrl,
}: {
  initial: WelcomeScreenValues;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState(initial);
  const fileInput = useRef<HTMLInputElement>(null);

  function set<K extends keyof WelcomeScreenValues>(key: K, value: WelcomeScreenValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateWelcomeScreen(values);
      if (result.ok) {
        toast.success(
          values.enabled ? "Đã lưu màn hình chào." : "Đã lưu — màn hình chào đang tắt.",
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function upload(file: File) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await setWelcomeImage(formData);
      if (result.ok) {
        toast.success("Đã lưu ảnh.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeImage() {
    startTransition(async () => {
      const result = await removeWelcomeImage();
      if (result.ok) {
        toast.success("Đã gỡ ảnh.");
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
          <span aria-hidden>👋</span>
          Màn hình chào
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-muted-foreground text-sm">
          Khi bật, người chưa đăng nhập thấy màn hình này trước, rồi bấm <strong>{WELCOME_BUTTON_LABEL}</strong>{" "}
          để sang trang đăng nhập. Khi tắt, họ vào thẳng trang đăng nhập.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox
            checked={values.enabled}
            onCheckedChange={(checked) => set("enabled", checked === true)}
          />
          Bật màn hình chào
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Hình nền</legend>
          <div role="radiogroup" aria-label="Hình nền" className="grid gap-2 sm:grid-cols-2">
            {WELCOME_THEMES.map((theme) => {
              const active = theme.id === values.theme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("theme", theme.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors",
                    active ? "border-primary bg-accent" : "hover:bg-accent/60",
                  )}
                >
                  <span
                    aria-hidden
                    className="bg-muted grid size-10 shrink-0 place-items-center rounded-full text-xl"
                  >
                    {theme.preview}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{theme.label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {theme.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-medium">Ảnh ở giữa</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-4" />
              {imageUrl ? "Đổi ảnh" : "Tải ảnh lên"}
            </Button>
            {imageUrl && (
              <Button variant="ghost" size="sm" disabled={isPending} onClick={removeImage}>
                <Trash2 className="size-4" />
                Gỡ ảnh
              </Button>
            )}
          </div>
          <p className="text-muted-foreground text-xs">PNG, JPG, WEBP hoặc GIF, tối đa 2 MB.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="welcome-title">Tiêu đề</Label>
          <Input
            id="welcome-title"
            value={values.title}
            maxLength={WELCOME_TITLE_MAX}
            placeholder="Ví dụ: Chào mừng cả nhà!"
            onChange={(event) => set("title", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="welcome-message">Nội dung</Label>
          <Textarea
            id="welcome-message"
            value={values.message}
            maxLength={WELCOME_MESSAGE_MAX}
            rows={8}
            placeholder="Một vài dòng chào mừng…"
            onChange={(event) => set("message", event.target.value)}
          />
          <p className="text-muted-foreground text-right text-xs tabular-nums">
            {values.message.length}/{WELCOME_MESSAGE_MAX}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="welcome-schedule">Lịch trình</Label>
          <Textarea
            id="welcome-schedule"
            value={values.schedule}
            maxLength={WELCOME_SCHEDULE_MAX}
            rows={10}
            className="font-mono text-xs"
            placeholder={"NGÀY 1 (12/04): ĐIỂM ĐI – ĐIỂM ĐẾN\n• 08:30: Xe đón cả đoàn…\n• 10:15 – 12:00 (Khám phá tự do):\n    • Câu cá: Mượn cần ra bờ suối…"}
            onChange={(event) => set("schedule", event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Có lịch trình thì khung lời mời có thêm liên kết <strong>Xem lịch trình</strong>. Mỗi
            dòng không có dấu • là một ngày; dòng • là một mốc, bắt đầu bằng giờ; dòng • thụt
            vào là chi tiết của mốc trên. Để trống thì không có liên kết.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="welcome-email-link">Chữ trên liên kết trong email Thông báo</Label>
          <Input
            id="welcome-email-link"
            value={values.emailLinkLabel}
            maxLength={SCHEDULE_LINK_LABEL_MAX}
            placeholder={DEFAULT_SCHEDULE_LINK_LABEL}
            onChange={(event) => set("emailLinkLabel", event.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Khi có lịch trình, cuối mỗi email Thông báo có một liên kết chữ lớn mở thẳng lịch
            trình. Để trống thì dùng “{DEFAULT_SCHEDULE_LINK_LABEL}”.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <RangeField
            id="welcome-text-scale"
            label="Cỡ chữ"
            unit="%"
            min={WELCOME_SCALE_MIN}
            max={WELCOME_SCALE_MAX}
            step={5}
            value={values.textScale}
            onChange={(value) => set("textScale", value)}
          />
          <RangeField
            id="welcome-image-scale"
            label="Cỡ ảnh"
            unit="%"
            min={WELCOME_SCALE_MIN}
            max={WELCOME_SCALE_MAX}
            step={5}
            value={values.imageScale}
            onChange={(value) => set("imageScale", value)}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Viền khung</legend>
          <div role="radiogroup" aria-label="Kiểu viền" className="flex flex-wrap gap-2">
            {WELCOME_BORDER_STYLES.map((style) => {
              const active = style.id === values.borderStyle;
              return (
                <button
                  key={style.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("borderStyle", style.id)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm transition-colors",
                    active ? "border-primary bg-accent font-medium" : "hover:bg-accent/60",
                  )}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RangeField
              id="welcome-border-width"
              label="Độ dày viền"
              unit="px"
              min={1}
              max={WELCOME_BORDER_WIDTH_MAX}
              step={1}
              value={values.borderWidth}
              disabled={values.borderStyle === "none"}
              onChange={(value) => set("borderWidth", value)}
            />
            <RangeField
              id="welcome-border-radius"
              label="Bo góc"
              unit="px"
              min={0}
              max={WELCOME_BORDER_RADIUS_MAX}
              step={2}
              value={values.borderRadius}
              onChange={(value) => set("borderRadius", value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="welcome-border-color">Màu viền</Label>
            <input
              id="welcome-border-color"
              type="color"
              value={values.borderColor || PICKER_FALLBACK}
              disabled={values.borderStyle === "none"}
              onChange={(event) => set("borderColor", event.target.value)}
              className="h-8 w-12 cursor-pointer rounded border bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {values.borderColor ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={values.borderStyle === "none"}
                onClick={() => set("borderColor", "")}
              >
                Dùng màu chủ đạo
              </Button>
            ) : (
              <span className="text-muted-foreground text-xs">Đang dùng màu chủ đạo</span>
            )}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-medium">Xem trước</p>
          <div className="bg-muted/40 flex flex-col items-center overflow-hidden rounded-lg border p-4 sm:p-8">
            <WelcomeContentBox
              content={{
                title: values.title.trim(),
                message: values.message.trim(),
                imageUrl,
                textScale: values.textScale,
                imageScale: values.imageScale,
                borderStyle: values.borderStyle,
                borderWidth: values.borderWidth,
                borderColor: values.borderColor,
                borderRadius: values.borderRadius,
              }}
            />
            <span className={cn("mt-6 inline-flex items-center", WELCOME_BUTTON_CLASS)}>
              {WELCOME_BUTTON_LABEL} →
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Hình nền chỉ hiện trên trang thật. Mở trong cửa sổ ẩn danh để xem như người chưa đăng
            nhập.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={isPending} onClick={save}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/welcome?xem-truoc=1" target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-4" />
            Xem trang
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RangeField({
  id,
  label,
  unit,
  min,
  max,
  step,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-primary w-full disabled:opacity-50"
      />
    </div>
  );
}
