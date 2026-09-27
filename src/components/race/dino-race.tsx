"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Flag, Loader2, Pencil, Play, Plus, RotateCcw, Share2, UserMinus, Video, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RACE_MAX_RUNNERS,
  RACE_MAX_SECONDS,
  RACE_MIN_RUNNERS,
  RACE_MIN_SECONDS,
  RACE_PRESET_SECONDS,
  RUNNER_NAME_MAX,
  clampSeconds,
  planRace,
  sameRunnerName,
  type RacePlan,
} from "@/lib/dino-race";
import { cn } from "cn";
import { RaceTrack } from "./race-track";
import { RACERS, RACER_KINDS, type RacerKind } from "./racers";
import { canRecord, videoFileName } from "./recording";

type Phase = "setup" | "racing" | "done";

/** The last race's film: not asked for, still being finished, unavailable, or ready to keep. */
type Film = "off" | "pending" | "failed" | { url: string; file: File };

const noSubscribe = () => () => {};

/** Someone on the list; only those ticked run. Guests are added by hand and can be removed. */
type Entry = { name: string; on: boolean; guest: boolean };

const MEDALS = ["🥇", "🥈", "🥉"];

/** The list keeps members and guests together, so it gets a cap of its own. */
const ROSTER_MAX = 100;

/** Ticks exactly the names in `wanted`, in list order, stopping at the race cap. */
function tickOnly(roster: Entry[], wanted: (entry: Entry) => boolean): Entry[] {
  let ticked = 0;
  return roster.map((entry) => {
    const on = wanted(entry) && ticked < RACE_MAX_RUNNERS;
    if (on) ticked++;
    return { ...entry, on };
  });
}

/**
 * The race: pick who runs, what they run as and for how long, then watch.
 * Everyone is listed — today's diners first — and today's diners start
 * ticked (or everyone, on a day fewer than two ordered). Guests are added
 * by name; the ticks are what decide who races.
 */
export function DinoRace({
  todayDiners,
  members,
}: {
  todayDiners: string[];
  members: string[];
}) {
  const [roster, setRoster] = useState<Entry[]>(() => {
    const entries: Entry[] = [];
    for (const name of [...todayDiners, ...members]) {
      if (!entries.some((entry) => sameRunnerName(entry.name, name))) {
        entries.push({ name, on: false, guest: false });
      }
    }
    const fromToday = todayDiners.length >= RACE_MIN_RUNNERS;
    return tickOnly(entries, (entry) =>
      fromToday ? todayDiners.some((name) => sameRunnerName(name, entry.name)) : true,
    );
  });
  const [kind, setKind] = useState<RacerKind>("dino");
  const [draft, setDraft] = useState("");
  const [seconds, setSeconds] = useState<number>(RACE_PRESET_SECONDS[1]);
  const [secondsInput, setSecondsInput] = useState(String(RACE_PRESET_SECONDS[1]));
  const [phase, setPhase] = useState<Phase>("setup");
  const [plan, setPlan] = useState<RacePlan | null>(null);
  // Bumped per race so the track remounts and its countdown starts afresh.
  const [raceId, setRaceId] = useState(0);
  // Read after hydration only: the server cannot know what this browser can film.
  const recordable = useSyncExternalStore(noSubscribe, canRecord, () => false);
  const [record, setRecord] = useState(false);
  const [film, setFilm] = useState<Film>("off");

  // A film's object URL holds the whole video in memory; let it go once replaced.
  useEffect(() => {
    if (typeof film !== "object") return;
    return () => URL.revokeObjectURL(film.url);
  }, [film]);

  const racer = RACERS[kind];
  const names = roster.filter((entry) => entry.on).map((entry) => entry.name);
  const canStart = names.length >= RACE_MIN_RUNNERS;
  const full = names.length >= RACE_MAX_RUNNERS;

  function toggle(name: string, on: boolean) {
    if (on && full) {
      toast.error(`Tối đa ${RACE_MAX_RUNNERS} người một lượt.`);
      return;
    }
    setRoster(roster.map((entry) => (entry.name === name ? { ...entry, on } : entry)));
  }

  function addDraft() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > RUNNER_NAME_MAX) {
      toast.error(`Tên dài quá — tối đa ${RUNNER_NAME_MAX} ký tự.`);
      return;
    }
    const existing = roster.find((entry) => sameRunnerName(entry.name, name));
    if (existing) {
      // Typing a name already on the list ticks it rather than refusing.
      if (existing.on) toast.error(`${existing.name} đã có trong danh sách.`);
      else toggle(existing.name, true);
      setDraft("");
      return;
    }
    if (roster.length >= ROSTER_MAX) {
      toast.error(`Danh sách tối đa ${ROSTER_MAX} người.`);
      return;
    }
    if (full) toast.info(`Đã đủ ${RACE_MAX_RUNNERS} người — ${name} được thêm nhưng chưa chọn.`);
    setRoster([...roster, { name, on: !full, guest: true }]);
    setDraft("");
  }

  function chooseSeconds(value: number) {
    const clamped = clampSeconds(value);
    setSeconds(clamped);
    setSecondsInput(String(clamped));
  }

  function start(list = roster) {
    const runners = list.filter((entry) => entry.on).map((entry) => entry.name);
    if (runners.length < RACE_MIN_RUNNERS) return;
    setRoster(list);
    setPlan(planRace(runners, seconds));
    setRaceId((id) => id + 1);
    setFilm(record && recordable ? "pending" : "off");
    setPhase("racing");
  }

  function stop() {
    setFilm("off");
    setPhase("setup");
  }

  function keepFilm(video: Blob | null) {
    if (!video) {
      setFilm("failed");
      return;
    }
    const file = new File([video], videoFileName(video.type), { type: video.type });
    setFilm({ url: URL.createObjectURL(file), file });
  }

  async function shareFilm(file: File) {
    try {
      await navigator.share({ files: [file], title: "Đua vui" });
    } catch (error) {
      // Closing the share sheet is not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("Không chia sẻ được video — thử nút Lưu video.");
      }
    }
  }

  if (phase !== "setup" && plan) {
    const ranking = plan.ranking.map((index) => plan.runners[index].name);
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              {phase === "racing" ? "Đang đua…" : "Kết quả"}{" "}
              <span className="text-muted-foreground font-normal">
                · {plan.runners.length} {racer.label.toLowerCase()} · {plan.durationMs / 1000}s
              </span>
            </CardTitle>
            {phase === "racing" && (
              <div className="flex items-center gap-2">
                {film === "pending" && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <span className="size-2 animate-pulse rounded-full bg-red-600" aria-hidden />
                    Đang quay
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={stop}>
                  <X className="size-4" />
                  Dừng
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <RaceTrack
              key={raceId}
              plan={plan}
              kind={kind}
              record={film === "pending"}
              onRecorded={keepFilm}
              onFinish={() => setPhase("done")}
            />
          </CardContent>
        </Card>

        {phase === "done" && (
          <Card>
            <CardContent className="space-y-4 py-5">
              <div role="status" className="text-center">
                <p className="text-4xl" aria-hidden>
                  🏆
                </p>
                <p className="mt-1 text-xl font-semibold">{ranking[0]} thắng!</p>
                <p className="text-muted-foreground text-sm">
                  Về chót: <strong>{ranking[ranking.length - 1]}</strong>
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Chỉ để vui — kết quả không được lưu.
                </p>
              </div>
              <ol className="divide-y rounded-lg border text-sm">
                {ranking.map((name, place) => (
                  <li key={name} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-6 text-center tabular-nums">
                      {MEDALS[place] ?? `${place + 1}.`}
                    </span>
                    <span className={place === 0 ? "font-semibold" : undefined}>{name}</span>
                  </li>
                ))}
              </ol>
              {film !== "off" && (
                <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3">
                  {film === "pending" && (
                    <span className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Loader2 className="size-4 animate-spin" />
                      Đang hoàn tất video…
                    </span>
                  )}
                  {film === "failed" && (
                    <span className="text-muted-foreground text-sm">
                      Trình duyệt này không quay được cuộc đua.
                    </span>
                  )}
                  {typeof film === "object" && (
                    <>
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={<a href={film.url} download={film.file.name} />}
                      >
                        <Download className="size-4" />
                        Lưu video
                      </Button>
                      {typeof navigator.canShare === "function" &&
                        navigator.canShare({ files: [film.file] }) && (
                          <Button variant="outline" onClick={() => shareFilm(film.file)}>
                            <Share2 className="size-4" />
                            Chia sẻ
                          </Button>
                        )}
                    </>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => start()}>
                  <RotateCcw className="size-4" />
                  Đua lại
                </Button>
                {names.length > RACE_MIN_RUNNERS && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      start(roster.map((entry) => (entry.name === ranking[0] ? { ...entry, on: false } : entry)))
                    }
                  >
                    <UserMinus className="size-4" />
                    Bỏ {ranking[0]}, đua tiếp
                  </Button>
                )}
                <Button variant="outline" onClick={() => setPhase("setup")}>
                  <Pencil className="size-4" />
                  Sửa danh sách
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Đua bằng gì</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label="Loại tay đua" className="grid grid-cols-3 gap-2">
            {RACER_KINDS.map((option) => (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={kind === option.kind}
                onClick={() => setKind(option.kind)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm transition-colors",
                  kind === option.kind
                    ? "border-primary bg-primary/5 font-medium"
                    : "hover:bg-muted",
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {option.emoji}
                </span>
                {option.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Ai đua{" "}
            <span className="text-muted-foreground font-normal">
              (đã chọn {names.length}/{RACE_MAX_RUNNERS})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={todayDiners.length === 0}
              onClick={() =>
                setRoster(
                  tickOnly(roster, (entry) => todayDiners.some((name) => sameRunnerName(name, entry.name))),
                )
              }
            >
              Người đặt hôm nay ({todayDiners.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRoster(tickOnly(roster, () => true))}>
              Chọn hết
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={names.length === 0}
              onClick={() => setRoster(tickOnly(roster, () => false))}
            >
              Bỏ chọn hết
            </Button>
          </div>

          {roster.length > 0 ? (
            <ul className="max-h-72 divide-y overflow-y-auto overscroll-contain rounded-lg border">
              {roster.map((entry) => {
                const id = `runner-${entry.name}`;
                const today = todayDiners.some((name) => sameRunnerName(name, entry.name));
                return (
                  <li key={entry.name} className="flex items-center gap-3 py-1 pr-1 pl-3">
                    <Checkbox
                      id={id}
                      checked={entry.on}
                      onCheckedChange={(checked) => toggle(entry.name, checked)}
                    />
                    <Label
                      htmlFor={id}
                      className={cn(
                        "min-w-0 flex-1 cursor-pointer py-1.5 font-normal",
                        !entry.on && "text-muted-foreground",
                      )}
                    >
                      <span className="truncate">{entry.name}</span>
                      {today && (
                        <span className="text-muted-foreground shrink-0 text-xs">· đặt hôm nay</span>
                      )}
                      {entry.guest && <span className="text-muted-foreground shrink-0 text-xs">· khách</span>}
                    </Label>
                    {entry.guest ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="size-7 rounded-full"
                        aria-label={`Xoá ${entry.name}`}
                        onClick={() => setRoster(roster.filter((other) => other.name !== entry.name))}
                      >
                        <X className="size-3.5" />
                      </Button>
                    ) : (
                      <span className="size-7" aria-hidden />
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Chưa có ai. Thêm tên bên dưới.</p>
          )}

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addDraft();
            }}
          >
            <Input
              value={draft}
              maxLength={RUNNER_NAME_MAX}
              placeholder="Thêm tên, ví dụ khách của phòng"
              aria-label="Tên người đua"
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!draft.trim()}>
              <Plus className="size-4" />
              Thêm
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Thời gian đua</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {RACE_PRESET_SECONDS.map((preset) => (
              <Button
                key={preset}
                size="sm"
                variant={seconds === preset ? "default" : "outline"}
                aria-pressed={seconds === preset}
                onClick={() => chooseSeconds(preset)}
              >
                {preset} giây
              </Button>
            ))}
            <div className="flex items-center gap-2">
              <Label htmlFor="race-seconds" className="text-muted-foreground font-normal">
                hoặc
              </Label>
              <Input
                id="race-seconds"
                type="number"
                inputMode="numeric"
                min={RACE_MIN_SECONDS}
                max={RACE_MAX_SECONDS}
                value={secondsInput}
                className="w-20"
                onChange={(event) => setSecondsInput(event.target.value)}
                onBlur={() => chooseSeconds(Number(secondsInput))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") chooseSeconds(Number(secondsInput));
                }}
              />
              <span className="text-muted-foreground text-sm">giây</span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs">
            Từ {RACE_MIN_SECONDS} đến {RACE_MAX_SECONDS} giây, chưa tính 3 giây đếm ngược.
          </p>
        </CardContent>
      </Card>

      {recordable && (
        <Card>
          <CardContent className="flex items-start gap-3">
            <Checkbox
              id="race-record"
              className="mt-0.5"
              checked={record}
              onCheckedChange={(checked) => setRecord(checked)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="race-record" className="cursor-pointer">
                <Video className="size-4" />
                Quay video cuộc đua
              </Label>
              <p className="text-muted-foreground text-xs">
                Đua xong bấm Lưu video để giữ về máy. Video chỉ nằm trên máy bạn, không gửi đi
                đâu cả.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Button size="lg" className="w-full" disabled={!canStart} onClick={() => start()}>
        {canStart ? <Play className="size-4" /> : <Flag className="size-4" />}
        {canStart
          ? `Bắt đầu đua · ${names.length} ${racer.label.toLowerCase()} · ${seconds} giây`
          : `Chọn ít nhất ${RACE_MIN_RUNNERS} người để đua`}
      </Button>
    </div>
  );
}
