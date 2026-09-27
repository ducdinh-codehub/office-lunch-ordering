"use client";

import { useState } from "react";
import { Flag, Pencil, Play, Plus, RotateCcw, Trash2, Users, UtensilsCrossed, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { RaceTrack } from "./race-track";

type Phase = "setup" | "racing" | "done";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Adds names to a list, skipping repeats and stopping at the cap. */
function mergeNames(current: string[], incoming: string[]): string[] {
  const next = [...current];
  for (const name of incoming) {
    if (next.length >= RACE_MAX_RUNNERS) break;
    if (!next.some((existing) => sameRunnerName(existing, name))) next.push(name);
  }
  return next;
}

/**
 * Đua khủng long: pick who runs and for how long, then watch. The list starts
 * as today's diners (or everyone, on a day nobody has ordered) and is freely
 * edited — add a guest, drop whoever is off — before each race.
 */
export function DinoRace({
  todayDiners,
  members,
}: {
  todayDiners: string[];
  members: string[];
}) {
  const [names, setNames] = useState<string[]>(() =>
    mergeNames([], todayDiners.length >= RACE_MIN_RUNNERS ? todayDiners : members),
  );
  const [draft, setDraft] = useState("");
  const [seconds, setSeconds] = useState<number>(RACE_PRESET_SECONDS[1]);
  const [secondsInput, setSecondsInput] = useState(String(RACE_PRESET_SECONDS[1]));
  const [phase, setPhase] = useState<Phase>("setup");
  const [plan, setPlan] = useState<RacePlan | null>(null);
  // Bumped per race so the track remounts and its countdown starts afresh.
  const [raceId, setRaceId] = useState(0);

  const canStart = names.length >= RACE_MIN_RUNNERS;

  function addDraft() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (name.length > RUNNER_NAME_MAX) {
      toast.error(`Tên dài quá — tối đa ${RUNNER_NAME_MAX} ký tự.`);
      return;
    }
    if (names.some((existing) => sameRunnerName(existing, name))) {
      toast.error(`${name} đã có trong danh sách.`);
      return;
    }
    if (names.length >= RACE_MAX_RUNNERS) {
      toast.error(`Tối đa ${RACE_MAX_RUNNERS} khủng long một lượt.`);
      return;
    }
    setNames([...names, name]);
    setDraft("");
  }

  function load(list: string[]) {
    setNames(mergeNames([], list));
  }

  function chooseSeconds(value: number) {
    const clamped = clampSeconds(value);
    setSeconds(clamped);
    setSecondsInput(String(clamped));
  }

  function start() {
    if (!canStart) return;
    setPlan(planRace(names, seconds));
    setRaceId((id) => id + 1);
    setPhase("racing");
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
                · {plan.runners.length} khủng long · {plan.durationMs / 1000}s
              </span>
            </CardTitle>
            {phase === "racing" && (
              <Button size="sm" variant="ghost" onClick={() => setPhase("setup")}>
                <X className="size-4" />
                Dừng
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-2 sm:px-4">
            <RaceTrack key={raceId} plan={plan} onFinish={() => setPhase("done")} />
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
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={start}>
                  <RotateCcw className="size-4" />
                  Đua lại
                </Button>
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
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span>
              Ai chạy{" "}
              <span className="text-muted-foreground font-normal">
                ({names.length}/{RACE_MAX_RUNNERS})
              </span>
            </span>
            {names.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setNames([])}>
                <Trash2 className="size-4" />
                Xoá hết
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={todayDiners.length === 0}
              onClick={() => load(todayDiners)}
            >
              <UtensilsCrossed className="size-4" />
              Người đặt hôm nay ({todayDiners.length})
            </Button>
            <Button size="sm" variant="outline" onClick={() => load(members)}>
              <Users className="size-4" />
              Tất cả thành viên ({members.length})
            </Button>
          </div>

          {names.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {names.map((name) => (
                <li
                  key={name}
                  className="bg-muted flex items-center gap-1 rounded-full py-1 pr-1 pl-3 text-sm"
                >
                  <span aria-hidden>🦖</span>
                  {name}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="size-6 rounded-full"
                    aria-label={`Bỏ ${name}`}
                    onClick={() => setNames(names.filter((existing) => existing !== name))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
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
              aria-label="Tên người chạy"
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

      <Button size="lg" className="w-full" disabled={!canStart} onClick={start}>
        {canStart ? <Play className="size-4" /> : <Flag className="size-4" />}
        {canStart
          ? `Bắt đầu đua · ${names.length} khủng long · ${seconds} giây`
          : `Cần ít nhất ${RACE_MIN_RUNNERS} người để đua`}
      </Button>
    </div>
  );
}
