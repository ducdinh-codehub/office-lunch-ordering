/**
 * A slow drift of food and drink behind the sign-in screens.
 *
 * Visible but unhurried: softened rather than hidden, so the drift reads at a
 * glance without competing with the form in front of it. Pure CSS, no client
 * JavaScript, and every position is fixed in this list rather than randomised —
 * random would differ between the server render and the browser's, which React
 * counts as a hydration error.
 */
const PIECES = [
  { emoji: "🍜", left: "6%", top: "12%", size: "3.75rem", drift: "a", delay: "0s" },
  { emoji: "☕", left: "18%", top: "68%", size: "3rem", drift: "b", delay: "3s" },
  { emoji: "🍱", left: "82%", top: "18%", size: "4rem", drift: "c", delay: "1s" },
  { emoji: "🍲", left: "72%", top: "76%", size: "3.5rem", drift: "a", delay: "6s" },
  { emoji: "🧋", left: "40%", top: "8%", size: "2.75rem", drift: "b", delay: "9s" },
  { emoji: "🍣", left: "88%", top: "48%", size: "3.25rem", drift: "a", delay: "4s" },
  { emoji: "🥗", left: "12%", top: "40%", size: "3rem", drift: "c", delay: "7s" },
  { emoji: "🍛", left: "58%", top: "88%", size: "3.75rem", drift: "b", delay: "2s" },
  { emoji: "🍵", left: "30%", top: "84%", size: "2.75rem", drift: "a", delay: "11s" },
  { emoji: "🍤", left: "66%", top: "34%", size: "3rem", drift: "c", delay: "5s" },
  { emoji: "🥐", left: "4%", top: "84%", size: "3.25rem", drift: "b", delay: "8s" },
  { emoji: "🍰", left: "92%", top: "80%", size: "2.75rem", drift: "a", delay: "13s" },
  { emoji: "🍙", left: "24%", top: "24%", size: "2.75rem", drift: "b", delay: "15s" },
  { emoji: "🥟", left: "50%", top: "52%", size: "3.25rem", drift: "c", delay: "10s" },
  { emoji: "🍹", left: "78%", top: "6%", size: "3rem", drift: "b", delay: "12s" },
  { emoji: "🍗", left: "36%", top: "66%", size: "3rem", drift: "a", delay: "14s" },
  { emoji: "🍉", left: "8%", top: "56%", size: "2.75rem", drift: "c", delay: "16s" },
  { emoji: "🥤", left: "62%", top: "14%", size: "2.75rem", drift: "a", delay: "17s" },
  { emoji: "🍩", left: "46%", top: "34%", size: "2.75rem", drift: "b", delay: "19s" },
  { emoji: "🌮", left: "94%", top: "62%", size: "3rem", drift: "c", delay: "18s" },
  { emoji: "🍇", left: "20%", top: "6%", size: "2.75rem", drift: "a", delay: "21s" },
  { emoji: "🍝", left: "84%", top: "34%", size: "2.75rem", drift: "b", delay: "23s" },
] as const;

const DRIFT_CLASS = {
  a: "animate-drift-a",
  b: "animate-drift-b",
  c: "animate-drift-c",
} as const;

export function FoodBackdrop() {
  return (
    <div
      aria-hidden
      className="food-backdrop pointer-events-none fixed inset-0 m-0 -z-10 overflow-hidden select-none"
    >
      {PIECES.map((piece, index) => (
        <span
          key={index}
          className={`${DRIFT_CLASS[piece.drift]} absolute opacity-40 grayscale-[0.25] dark:opacity-30`}
          style={{
            left: piece.left,
            top: piece.top,
            fontSize: piece.size,
            animationDelay: piece.delay,
          }}
        >
          {piece.emoji}
        </span>
      ))}
    </div>
  );
}
