import Link from "next/link";
import { Check, Clock, Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MenuItemRow } from "./menu-item-row";
import { SetDishRow } from "./set-dish-row";
import { MenuSection } from "./menu-section";
import { SetTierBadges } from "./set-tier-badges";
import { SetCompleteDialog } from "./set-complete-dialog";
import { bookingClosedReason, isBookingOpen, type MenuDayWithItems } from "@/db/queries/menu";
import {
  maxSetPicks,
  missingFor,
  resolveSetTier,
  setTiers,
  type SetCounts,
  type SetTier,
} from "@/lib/set-tiers";
import { getShipShares, getUserBookingsForDay, getUserSetPriceForDay } from "@/db/queries/bookings";
import { formatInstant, formatServiceDate, type ServiceDate } from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { MenuItemCategory, SetTierKey } from "@/db/schema";

const SET_SECTIONS = [
  { category: "main", label: "Món chính", emoji: "🥩" },
  { category: "side", label: "Món phụ", emoji: "🍳" },
  { category: "veg", label: "Món rau", emoji: "🥬" },
] as const;

const PAID_SECTIONS = [
  { category: "addon", label: "Gọi thêm", emoji: "🥡" },
  { category: "drink", label: "Đồ uống", emoji: "🍹" },
] as const;

export async function MenuDayView({
  serviceDate,
  day,
  userId,
  onBehalfOf,
  selectedTier = null,
}: {
  serviceDate: ServiceDate;
  day: MenuDayWithItems | null;
  userId: string;
  /**
   * Set when an admin is ordering for this person. It rides along to the
   * actions, which re-check the caller is an admin, and it lifts the cutoff —
   * ordering late by hand is the point of the override.
   */
  onBehalfOf?: string;
  /**
   * Which suất the diner tapped, from the `suat` query parameter. Null means
   * they have not chosen yet, and the day is read the old way: whichever suất
   * their picks happen to match.
   */
  selectedTier?: SetTierKey | null;
}) {
  const [myBookings, lockedSetPrice, shipShares] = await Promise.all([
    getUserBookingsForDay(userId, serviceDate),
    getUserSetPriceForDay(userId, serviceDate),
    getShipShares({ dates: [serviceDate] }),
  ]);

  const myShipVnd = shipShares.find((share) => share.userId === userId)?.shareVnd ?? 0;
  const shipDinerCount = shipShares.length;

  const quantityByItem = new Map(myBookings.map((b) => [b.menuItemId, b.quantity]));
  const paidTotal = myBookings.reduce((total, b) => total + b.lineTotalVnd, 0);

  const canBook = day ? isBookingOpen(day) || Boolean(onBehalfOf) : false;
  const closedReason = bookingClosedReason(day);

  if (!day || day.status === "draft") {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-12 text-center">
          <p className="text-3xl" aria-hidden>
            🍜
          </p>
          <p className="mt-3 font-medium">Chưa có thực đơn cho {formatServiceDate(serviceDate)}.</p>
          <p className="mt-1 text-sm">Bạn quay lại sau một chút nhé.</p>
        </CardContent>
      </Card>
    );
  }

  const itemsIn = (category: MenuItemCategory) =>
    day.items.filter((item) => item.category === category);

  // A day offers one suất, or two — e.g. 1 món chính at 40.000 ₫ beside 2 at
  // 50.000 ₫. Which one a diner is on follows from what they picked.
  const tiers = setTiers(day);
  const picked: SetCounts = {
    main: countPicked(myBookings, itemsIn("main")),
    side: countPicked(myBookings, itemsIn("side")),
    veg: countPicked(myBookings, itemsIn("veg")),
  };

  // The suất is offered only if the day actually has set dishes to pick from.
  const offersSet =
    tiers.length > 0 && SET_SECTIONS.some(({ category }) => itemsIn(category).length > 0);
  // What they are actually billed: still the suất their picks match exactly.
  const currentTier = offersSet ? resolveSetTier(day, picked) : null;
  const setComplete = Boolean(currentTier);

  // The suất being picked towards: the one they tapped, or the day's primary one
  // — `full`, the plain `set_price_vnd` — as the default, so the card always has
  // a target to count against and the common order needs no tap at all.
  const activeTier =
    tiers.find((tier) => tier.key === selectedTier) ??
    tiers.find((tier) => tier.key === "full") ??
    tiers[0] ??
    null;
  // Quotas follow that target. It is only a target: stopping early on a smaller
  // suất still completes that smaller one, which is what `currentTier` reports.
  const maxPicks = activeTier ? activeTier.required : maxSetPicks(day);
  const setStarted = picked.main + picked.side + picked.veg > 0;

  // What they'd owe: the price locked in on their day_orders row, today's price
  // of the tier they have completed otherwise.
  const setPrice = lockedSetPrice ?? currentTier?.priceVnd ?? 0;
  const dayTotal = (setComplete ? setPrice : 0) + paidTotal + myShipVnd;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">{formatServiceDate(serviceDate)}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {offersSet && (
              <SetTierBadges
                tiers={tiers
                  .filter((tier) => tier.priceVnd > 0)
                  .map((tier) => ({
                    key: tier.key,
                    priceVnd: tier.priceVnd,
                    composition: tierComposition(tier),
                  }))}
                activeKey={activeTier?.key ?? null}
              />
            )}
            {day.shipFeeVnd > 0 && (
              <Badge variant="outline" className="tabular-nums">
                Ship {formatVnd(day.shipFeeVnd)} chia đều
              </Badge>
            )}
            {day.status === "locked" ? (
              <Badge variant="secondary" className="gap-1">
                <Lock className="size-3" />
                Đã chốt
              </Badge>
            ) : day.orderCutoff ? (
              <Badge variant={canBook ? "outline" : "secondary"} className="gap-1">
                <Clock className="size-3" />
                {canBook ? "Đặt trước" : "Đã đóng"} {formatInstant(day.orderCutoff)}
              </Badge>
            ) : null}
          </div>
        </div>
        {day.note && <p className="text-muted-foreground text-sm">{day.note}</p>}
        {!canBook && closedReason && (
          <p className="text-muted-foreground bg-muted mt-1 rounded-md px-3 py-2 text-sm">
            {closedReason}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {day.items.length === 0 && (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Thực đơn đã đăng nhưng chưa có món nào.
          </p>
        )}

        {offersSet && (
          <>
            {/* Where the diner stands against the day's suất. */}
            <div
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                setComplete
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                  : "bg-muted/50"
              }`}
            >
              {activeTier && (
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {setComplete ? (
                      <span className="flex items-center gap-1.5 font-medium text-emerald-800 dark:text-emerald-300">
                        <Check className="size-4" />
                        Suất của bạn đã đủ món
                        {/* They stopped on a different suất from the one they are
                            aiming at — say which one is being charged. */}
                        {currentTier && currentTier.key !== activeTier.key && (
                          <span className="font-normal">
                            — đang tính suất {formatVnd(currentTier.priceVnd)}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="font-medium">
                        {setStarted ? "Suất chưa đủ món" : "Chọn đủ món để đặt suất"}
                      </span>
                    )}
                    {SET_SECTIONS.filter(
                      ({ category }) => activeTier.required[category] > 0,
                    ).map(({ category, label }) => (
                      <span
                        key={category}
                        className={
                          picked[category] === activeTier.required[category]
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground"
                        }
                      >
                        {label} {picked[category]}/{activeTier.required[category]}
                      </span>
                    ))}
                  </div>

                  {/* What the other suất would ask for, so switching is an
                      informed tap rather than a guess. */}
                  {tiers
                    .filter((tier) => tier.key !== activeTier.key)
                    .map((tier) => (
                      <p key={tier.key} className="text-muted-foreground text-xs">
                        Suất {formatVnd(tier.priceVnd)}: {tierComposition(tier)} —{" "}
                        {tierStatus(tier, picked)}
                      </p>
                    ))}
                </div>
              )}
              {!setComplete && setStarted && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Chưa đủ món thì suất chưa được tính tiền và bếp chưa nhận.
                </p>
              )}
            </div>

            {SET_SECTIONS.map(({ category, label, emoji }) => {
              const items = itemsIn(category);
              if (items.length === 0) return null;
              // The cap is the most generous tier: on a day selling 1 or 2 món
              // chính, a diner picking their first one is not finished yet.
              const full = picked[category] >= maxPicks[category];

              return (
                <MenuSection
                  key={category}
                  emoji={emoji}
                  label={label}
                  hint={`chọn ${maxPicks[category]} món`}
                  summary={
                    <span
                      className={
                        full
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }
                    >
                      {picked[category]}/{maxPicks[category]}
                      {full ? " — đã đủ" : ""}
                    </span>
                  }
                  // A category that is already satisfied starts folded away, so
                  // what still needs choosing is what you see first.
                  defaultOpen={!full}
                >
                  {items.map((item) => (
                    <SetDishRow
                      key={item.id}
                      item={item}
                      selected={quantityByItem.has(item.id)}
                      canSelect={!full}
                      canBook={canBook}
                      onBehalfOf={onBehalfOf}
                    />
                  ))}
                </MenuSection>
              );
            })}
          </>
        )}

        {PAID_SECTIONS.map(({ category, label, emoji }) => {
          const items = itemsIn(category);
          if (items.length === 0) return null;

          const chosen = items.filter((item) => quantityByItem.has(item.id));
          const chosenCount = chosen.reduce(
            (total, item) => total + (quantityByItem.get(item.id) ?? 0),
            0,
          );

          // "Gọi thêm" tops up a suất, so it stays hidden until the set is
          // complete — matching the rule setBooking enforces. Anything already
          // chosen keeps the section visible even if the set later falls apart,
          // so nothing is billed from a section the diner cannot see.
          const locked = category === "addon" && offersSet && !setComplete;
          if (locked && chosenCount === 0) return null;

          return (
            <MenuSection
              key={category}
              emoji={emoji}
              label={label}
              hint={locked ? "hoàn tất suất để giữ món" : "tính tiền riêng"}
              summary={
                chosenCount > 0 ? (
                  <span className="text-primary font-medium">đã chọn {chosenCount}</span>
                ) : (
                  <span className="text-muted-foreground">{items.length} món</span>
                )
              }
              // Extras are optional, so they stay out of the way until wanted —
              // unless something is already in the basket.
              defaultOpen={chosenCount > 0}
            >
              {items.map((item) => (
                <MenuItemRow
                  key={item.id}
                  item={item}
                  quantity={quantityByItem.get(item.id) ?? 0}
                  canBook={canBook}
                  onBehalfOf={onBehalfOf}
                />
              ))}
            </MenuSection>
          );
        })}

        {(dayTotal > 0 || setStarted) && (
          <div className="space-y-1 border-t pt-4 text-sm">
            {setComplete && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Suất cơm</span>
                <span className="tabular-nums">{formatVnd(setPrice)}</span>
              </div>
            )}
            {paidTotal > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Gọi thêm & đồ uống</span>
                <span className="tabular-nums">{formatVnd(paidTotal)}</span>
              </div>
            )}
            {myShipVnd > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Phí ship
                  <span className="text-xs">
                    {" "}
                    ({formatVnd(day.shipFeeVnd)} ÷ {shipDinerCount} người)
                  </span>
                </span>
                <span className="tabular-nums">{formatVnd(myShipVnd)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 font-semibold">
              <span>Tổng</span>
              <span className="tabular-nums">{formatVnd(dayTotal)}</span>
            </div>
          </div>
        )}

        {/* Announced the moment a suất is completed, not while one already is. */}
        {offersSet && (
          <SetCompleteDialog
            complete={setComplete}
            detail={
              currentTier
                ? `Suất ${formatVnd(setPrice)} đã được tính vào đơn hôm nay.`
                : undefined
            }
          />
        )}

        {dayTotal > 0 && (
          <Link
            href="/me/payments"
            className="text-muted-foreground hover:text-foreground block text-center text-xs underline underline-offset-4"
          >
            Thanh toán →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

/** e.g. "2 món chính · 1 món phụ · 1 món rau" — what a suất is made of. */
function tierComposition(tier: SetTier): string {
  return SET_SECTIONS.filter(({ category }) => tier.required[category] > 0)
    .map(({ category, label }) => `${tier.required[category]} ${label.toLowerCase()}`)
    .join(" · ");
}

/** How far a selection is from one suất, in the diner's own words. */
function tierStatus(tier: SetTier, picked: SetCounts): string {
  const missing = missingFor(tier, picked);
  const phrase = (sign: 1 | -1) =>
    SET_SECTIONS.filter(({ category }) => missing[category] * sign > 0)
      .map(({ category, label }) => `${missing[category] * sign} ${label.toLowerCase()}`)
      .join(", ");

  const short = phrase(1);
  if (short) return `còn thiếu ${short}`;

  const over = phrase(-1);
  if (over) return `bỏ bớt ${over}`;

  return "đã đủ món";
}

/** How many of `items` the diner has booked. */
function countPicked(
  myBookings: Array<{ menuItemId: string }>,
  items: Array<{ id: string }>,
): number {
  const booked = new Set(myBookings.map((b) => b.menuItemId));
  return items.filter((item) => booked.has(item.id)).length;
}
