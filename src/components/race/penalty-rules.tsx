import { cn } from "cn";

/**
 * The shootout's rules, told as one worked example — the same one on the
 * setup page and on the pitch before the first kick, so what a viewer reads
 * and what they then watch agree. The rules themselves live in `planShootout`.
 */
export const RULE_EXAMPLE: { round: number; kicks: [string, boolean][]; note: string }[] = [
  {
    round: 1,
    kicks: [
      ["A", true],
      ["B", false],
      ["C", true],
      ["D", false],
    ],
    note: "Sút hỏng là bị loại — B và D ra về",
  },
  {
    round: 2,
    kicks: [
      ["A", false],
      ["C", false],
    ],
    note: "Cả lượt đều hỏng → không ai bị loại, đá lại",
  },
  {
    round: 3,
    kicks: [
      ["A", true],
      ["C", false],
    ],
    note: "Chỉ còn A → A vô địch 🏆",
  },
];

/** A miss knocks you out only when someone else in the round scored. */
export const knockedOut = (kicks: [string, boolean][], scored: boolean) => !scored && kicks.some(([, goal]) => goal);

export const RULE_SUMMARY = "Mỗi lượt, ai còn trong cuộc sút 1 quả. Thủ môn là một người chơi khác.";

/** The setup page's copy of the rules. */
export function PenaltyRules() {
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">{RULE_SUMMARY}</p>
      <ol className="space-y-2">
        {RULE_EXAMPLE.map(({ round, kicks, note }) => (
          <li key={round} className="rounded-lg border px-3 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground w-14 shrink-0 text-xs font-medium">Lượt {round}</span>
              {kicks.map(([name, scored]) => (
                <span
                  key={name}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-semibold",
                    scored
                      ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
                    knockedOut(kicks, scored) && "line-through decoration-2",
                  )}
                >
                  {name} {scored ? "✅" : "❌"}
                </span>
              ))}
            </div>
            <p className="mt-1 text-xs">{note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
