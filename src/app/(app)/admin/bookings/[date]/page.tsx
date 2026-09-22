import { Fragment } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { LinkButton } from "@/components/ui/link-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyKitchenList } from "@/components/admin/copy-kitchen-list";
import { OrderForUser } from "@/components/admin/order-for-user";
import { MenuDayView } from "@/components/menu/menu-day-view";
import {
  getDayBookingsByPerson,
  getDayOrdersByPerson,
  getKitchenSummary,
} from "@/db/queries/bookings";
import { getMenuDay } from "@/db/queries/menu";
import { parseSelectedTier } from "@/lib/set-tiers";
import { getAllDiners } from "@/db/queries/users";
import {
  formatServiceDate,
  formatServiceDateShort,
  isServiceDate,
  shiftServiceDate,
  todayServiceDate,
} from "@/lib/date";
import { formatVnd } from "@/lib/money";
import type { MenuItemCategory } from "@/db/schema";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { category: "main", label: "Món chính" },
  { category: "side", label: "Món phụ" },
  { category: "veg", label: "Món rau" },
  { category: "addon", label: "Gọi thêm" },
  { category: "drink", label: "Đồ uống" },
] as const satisfies ReadonlyArray<{ category: MenuItemCategory; label: string }>;

export default async function AdminDayBookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ for?: string; suat?: string }>;
}) {
  const { date } = await params;
  if (!isServiceDate(date)) notFound();

  const { for: forUserId, suat } = await searchParams;
  const today = todayServiceDate();

  const [kitchen, people, setOrders, day, diners] = await Promise.all([
    getKitchenSummary(date),
    getDayBookingsByPerson(date),
    getDayOrdersByPerson(date),
    getMenuDay(date),
    getAllDiners(),
  ]);

  const orderingFor = diners.find((diner) => diner.id === forUserId) ?? null;

  const shipFeeVnd = day?.shipFeeVnd ?? 0;

  const ordered = kitchen.filter((line) => line.totalQuantity > 0);

  // Set dishes are covered by the suất price; only add-ons and drinks are billed
  // per portion, so the day's money is sets + paid lines.
  const setTotalVnd = setOrders.reduce((total, order) => total + order.setPriceVnd, 0);
  // A day can sell two suất, and a price edit can leave older snapshots behind,
  // so the quán is told how many of each price rather than one bare headcount.
  const setGroups = [
    ...setOrders
      .reduce(
        (groups, order) =>
          groups.set(order.setPriceVnd, (groups.get(order.setPriceVnd) ?? 0) + 1),
        new Map<number, number>(),
      )
      .entries(),
  ]
    .map(([priceVnd, count]) => ({ priceVnd, count }))
    .sort((a, b) => b.priceVnd - a.priceVnd);
  const paidTotalVnd = ordered
    .filter((line) => line.category === "addon" || line.category === "drink")
    .reduce((total, line) => total + line.totalQuantity * line.priceVnd, 0);
  // The quán charges the delivery once for the whole order, not per person.
  const totalVnd = setTotalVnd + paidTotalVnd + shipFeeVnd;

  const totalDishes = ordered.reduce((total, line) => total + line.totalQuantity, 0);
  // Everyone with a complete set, plus anyone who only ordered à-la-carte.
  const headcount = new Set([
    ...setOrders.map((order) => order.userId),
    ...people.map((person) => person.userId),
  ]).size;

  const linesFor = (categories: MenuItemCategory[]) =>
    ordered.filter((line) => categories.includes(line.category));

  // What gets pasted into the chat with the quán.
  const kitchenText = [
    `Đơn cơm trưa — ${formatServiceDate(date)}`,
    ...(setGroups.length > 1
      ? setGroups.map((group) => `${group.count} suất ${formatVnd(group.priceVnd)}`)
      : [`${setOrders.length} suất`]),
    ...SECTIONS.flatMap(({ category, label }) => {
      const lines = linesFor([category]);
      if (lines.length === 0) return [];
      return [``, `${label}:`, ...lines.map((line) => `${line.totalQuantity}x ${line.itemName}`)];
    }),
    ``,
    ...(shipFeeVnd > 0 ? [`Phí ship: ${formatVnd(shipFeeVnd)}`] : []),
    `Tổng: ${formatVnd(totalVnd)}`,
  ].join("\n");

  // The same day grouped by diner, one line each — short enough to read in a
  // chat without scrolling. `people` is already ordered by name, then dish.
  const byPerson = new Map<string, { name: string; dishes: string[] }>();
  for (const row of people) {
    const entry = byPerson.get(row.userId) ?? {
      name: row.displayName ?? row.email.split("@")[0],
      dishes: [],
    };
    entry.dishes.push(row.quantity > 1 ? `${row.itemName} x${row.quantity}` : row.itemName);
    byPerson.set(row.userId, entry);
  }

  const peopleText = [...byPerson.values()]
    .map(({ name, dishes }) => `${name}(${dishes.join("; ")})`)
    .join("\n");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Danh sách bếp</h1>
          <p className="text-muted-foreground text-sm">{formatServiceDate(date)}</p>
        </div>
        <LinkButton href={`/admin/menu?date=${date}`} variant="outline" size="sm">
          <ChevronLeft className="size-4" />
          Sửa thực đơn
        </LinkButton>
      </div>

      {/* The nav tab lands on today, so days are switched from here. */}
      <div className="flex flex-wrap gap-1.5">
        {[-1, 0, 1, 2].map((offset) => {
          const target = shiftServiceDate(today, offset);
          const label = offset === 0 ? "Hôm nay" : formatServiceDateShort(target);
          return (
            <LinkButton
              key={target}
              href={`/admin/bookings/${target}`}
              size="sm"
              variant={target === date ? "default" : "outline"}
            >
              {label}
            </LinkButton>
          );
        })}
      </div>

      <OrderForUser
        serviceDate={date}
        users={diners}
        selectedUserId={orderingFor?.id ?? null}
      >
        {orderingFor && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Đang chọn món cho{" "}
              <span className="text-foreground font-medium">{orderingFor.name}</span>{" "}
              <span className="text-xs">({orderingFor.email})</span>. Mọi thay đổi lưu
              ngay, kể cả khi đã quá giờ chốt.
            </p>
            {/* Keyed so switching person remounts every optimistic row. */}
            <MenuDayView
              key={orderingFor.id}
              serviceDate={date}
              day={day}
              userId={orderingFor.id}
              onBehalfOf={orderingFor.id}
              selectedTier={parseSelectedTier(suat)}
            />
          </div>
        )}
      </OrderForUser>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Số suất", value: String(setOrders.length) },
          { label: "Số người", value: String(headcount) },
          { label: "Số món", value: String(totalDishes) },
          { label: "Tổng tiền", value: formatVnd(totalVnd) },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4 text-center">
              <p className="text-muted-foreground text-xs">{stat.label}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Đơn gửi quán</CardTitle>
            {ordered.length > 0 && <CopyKitchenList text={kitchenText} />}
          </div>
        </CardHeader>
        <CardContent>
          {ordered.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              Chưa ai đặt món cho ngày này.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Món</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SECTIONS.map(({ category, label }) => {
                  const lines = linesFor([category]);
                  if (lines.length === 0) return null;
                  const isSet = category === "main" || category === "side" || category === "veg";
                  return (
                    <Fragment key={category}>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableCell colSpan={3} className="text-muted-foreground text-xs font-medium">
                          {label}
                        </TableCell>
                      </TableRow>
                      {lines.map((line) => (
                        <TableRow key={line.menuItemId}>
                          <TableCell className="font-medium">{line.itemName}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {line.totalQuantity}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right tabular-nums">
                            {isSet ? "theo suất" : formatVnd(line.totalQuantity * line.priceVnd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                })}
                {setGroups.length === 0 ? (
                  <TableRow>
                    <TableCell className="font-medium">Suất cơm</TableCell>
                    <TableCell className="text-right tabular-nums">0</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatVnd(0)}
                    </TableCell>
                  </TableRow>
                ) : (
                  setGroups.map((group) => (
                    <TableRow key={group.priceVnd}>
                      <TableCell className="font-medium">
                        Suất cơm
                        {setGroups.length > 1 && (
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            {formatVnd(group.priceVnd)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{group.count}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatVnd(group.count * group.priceVnd)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
                {shipFeeVnd > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">
                      Phí ship
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        (chia đều {setOrders.length > 0 ? `${setOrders.length} người` : ""})
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">—</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatVnd(shipFeeVnd)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {people.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Ai đặt món gì</CardTitle>
              <CopyKitchenList text={peopleText} />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người đặt</TableHead>
                  <TableHead>Món</TableHead>
                  <TableHead className="text-right">SL</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person, index) => (
                  <TableRow key={`${person.userId}-${person.itemName}-${index}`}>
                    <TableCell>
                      <span className="font-medium">
                        {person.displayName ?? person.email.split("@")[0]}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {person.email}
                      </span>
                      {person.note && (
                        <span className="text-muted-foreground block text-xs">
                          {person.note}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{person.itemName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {person.quantity}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {person.category === "addon" || person.category === "drink"
                        ? formatVnd(person.quantity * person.unitPriceVnd)
                        : "theo suất"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
