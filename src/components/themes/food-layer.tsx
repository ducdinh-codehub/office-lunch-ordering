import type { CSSProperties } from "react";

import { Hotpot, PhoBowl, SpringRolls } from "./dishes";

/*
 * The food that floats behind a seasonal backdrop: emoji hovering in place,
 * more rising up the screen like released balloons, and the drawn phở, chả
 * giò and lẩu doing both. Shared so every theme that wants food gets the same
 * spread — a change here shows up in all of them.
 *
 * Render it inside a backdrop's fixed, `-z-10` container; it positions itself
 * against that. Positions and delays are written out rather than randomised so
 * the server and client render the same markup. The animations are the
 * `.food-*` classes and the `animate-drift-*` utilities in globals.css.
 */

type Vars = CSSProperties & Record<`--${string}`, string>;

/**
 * `phone: true` keeps an item on narrow screens. A phone's column is filled
 * edge to edge by the cards, so the whole spread there reads as clutter — only
 * the marked few are drawn below Tailwind's `sm` breakpoint.
 */
type PhoneFlag = { phone?: true };

/** Something hovering in place on one of the three drift paths. */
export type Treat = {
  top: string;
  left: string;
  size: string;
  emoji: string;
  drift: string;
} & PhoneFlag;

/** Hides anything not marked for phones below the `sm` breakpoint. */
function phoneClass(item: PhoneFlag): string {
  return item.phone ? "" : "hidden sm:block";
}

/** Food hovering in place, each wandering on one of the three drift paths. */
const treats: Treat[] = [
  { top: "30%", left: "6%", size: "2rem", emoji: "🍠", drift: "animate-drift-a", phone: true },
  { top: "52%", left: "78%", size: "1.75rem", emoji: "🌰", drift: "animate-drift-b" },
  { top: "44%", left: "18%", size: "1.5rem", emoji: "🥟", drift: "animate-drift-b", phone: true },
  { top: "62%", left: "90%", size: "1.75rem", emoji: "🍵", drift: "animate-drift-a", phone: true },
  { top: "78%", left: "24%", size: "1.5rem", emoji: "🍢", drift: "animate-drift-c" },
  { top: "92%", left: "48%", size: "1.75rem", emoji: "🧋", drift: "animate-drift-b" },
];

/** The drawn dishes, by name — phở, chả giò and lẩu have no fitting emoji. */
const DISHES = { pho: PhoBowl, "cha-gio": SpringRolls, lau: Hotpot } as const;
type DishId = keyof typeof DISHES;

/** The drawn dishes hovering at the sides, larger than the emoji around them. */
const dishes: ({
  top: string;
  left: string;
  width: string;
  dish: DishId;
  drift: string;
} & PhoneFlag)[] = [
  { top: "18%", left: "80%", width: "5.5rem", dish: "pho", drift: "animate-drift-c", phone: true },
  { top: "54%", left: "2%", width: "6rem", dish: "cha-gio", drift: "animate-drift-a" },
  { top: "72%", left: "84%", width: "5rem", dish: "lau", drift: "animate-drift-b", phone: true },
];

/** And one of each in flight, on slower, longer climbs than the emoji. */
const flyingDishes: ({
  left: string;
  width: string;
  dish: DishId;
  duration: number;
  delay: number;
  rest: string;
} & PhoneFlag)[] = [
  {
    left: "34%",
    width: "4.5rem",
    dish: "pho",
    duration: 46,
    delay: -12,
    rest: "-50vh",
    phone: true,
  },
  { left: "48%", width: "5rem", dish: "cha-gio", duration: 52, delay: -36, rest: "-80vh" },
  { left: "64%", width: "4.25rem", dish: "lau", duration: 49, delay: -3, rest: "-30vh" },
];

/**
 * Food in flight: rising slowly up the whole screen like released balloons,
 * tilting as they go. Staggered so there are always two or three in the air.
 */
const flyers: ({
  left: string;
  size: string;
  emoji: string;
  duration: number;
  delay: number;
  /** Where it parks when motion is reduced. */
  rest: string;
} & PhoneFlag)[] = [
  { left: "8%", size: "1.75rem", emoji: "☕", duration: 34, delay: -6, rest: "-40vh", phone: true },
  { left: "21%", size: "1.5rem", emoji: "🍩", duration: 41, delay: -24, rest: "-75vh" },
  {
    left: "59%",
    size: "1.5rem",
    emoji: "🍪",
    duration: 44,
    delay: -33,
    rest: "-25vh",
    phone: true,
  },
  { left: "72%", size: "1.75rem", emoji: "🍠", duration: 36, delay: -2, rest: "-65vh" },
  { left: "86%", size: "1.5rem", emoji: "🥧", duration: 40, delay: -19, rest: "-45vh" },
];

/** `extraTreats` lets a theme float its own non-food props alongside, e.g. a scarf. */
export function FoodLayer({ extraTreats = [] }: { extraTreats?: Treat[] }) {
  return (
    <>
      {[...treats, ...extraTreats].map((treat, i) => (
        <span
          key={`treat-${i}`}
          className={`absolute opacity-20 dark:opacity-30 ${treat.drift} ${phoneClass(treat)}`}
          style={{ top: treat.top, left: treat.left, fontSize: treat.size }}
        >
          {treat.emoji}
        </span>
      ))}

      {dishes.map((entry, i) => {
        const Dish = DISHES[entry.dish];
        return (
          <div
            key={`dish-${i}`}
            className={`food-dish absolute ${entry.drift} ${phoneClass(entry)}`}
            style={{ top: entry.top, left: entry.left, width: entry.width }}
          >
            <Dish className="block w-full" />
          </div>
        );
      })}

      {flyingDishes.map((entry, i) => {
        const Dish = DISHES[entry.dish];
        return (
          <div
            key={`flying-dish-${i}`}
            className={`food-float absolute -bottom-24 ${phoneClass(entry)}`}
            style={
              {
                left: entry.left,
                width: entry.width,
                "--float-duration": `${entry.duration}s`,
                "--float-delay": `${entry.delay}s`,
                "--rest-y": entry.rest,
              } as Vars
            }
          >
            <div className="food-sway food-dish">
              <Dish className="block w-full" />
            </div>
          </div>
        );
      })}

      {flyers.map((flyer, i) => (
        <div
          key={`flyer-${i}`}
          className={`food-float absolute -bottom-12 ${phoneClass(flyer)}`}
          style={
            {
              left: flyer.left,
              fontSize: flyer.size,
              "--float-duration": `${flyer.duration}s`,
              "--float-delay": `${flyer.delay}s`,
              "--rest-y": flyer.rest,
            } as Vars
          }
        >
          <span className="food-sway block opacity-30 dark:opacity-40">{flyer.emoji}</span>
        </div>
      ))}
    </>
  );
}
