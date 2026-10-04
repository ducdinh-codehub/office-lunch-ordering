/**
 * Fills a week of realistic lunch history so the unpaid / pending / rejected
 * states can be seen in the UI.
 *
 * Run with: pnpm db:seed-demo
 *
 * Scoped on purpose: it only deletes rows inside the date window it is about to
 * seed, and only touches the demo users it creates plus the real accounts it
 * finds. Nothing outside that window is read or written, so an existing history
 * either side of it survives.
 */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db } from "../src/db/index.js";
import {
  bookings,
  dayOrders,
  menuDays,
  menuItems,
  payments,
  users,
} from "../src/db/schema.js";
import { freezeShipDinerCount, syncDayOrder } from "../src/db/queries/bookings.js";
import {
  localInputToInstant,
  parseServiceDate,
  shiftServiceDate,
  todayServiceDate,
} from "../src/lib/date.js";
import { formatVnd } from "../src/lib/money.js";

const SET_PRICE = 50_000;
const SHIP_FEE = 30_000;
const DAYS_BACK = 9; // calendar days scanned; weekends are skipped below.

/** The menu every seeded day gets — the real CƠM THANH list, trimmed. */
const DISHES: Array<[string, "main" | "side" | "veg" | "addon" | "drink", number]> = [
  ["Thịt Nấu Giả Cầy", "main", 0],
  ["Bò Om Khoai", "main", 0],
  ["Thịt Nạc Xào Đỗ", "main", 0],
  ["Heo Quay Giòn Bì", "main", 0],
  ["Cá Sốt Cà Chua", "main", 0],
  ["Trứng Hấp Thịt", "side", 0],
  ["Đậu Sốt Cà Chua", "side", 0],
  ["Lạc Rang", "side", 0],
  ["Bắp Cải Luộc", "veg", 0],
  ["Cải Chip Xào", "veg", 0],
  ["Dưa Muối", "veg", 0],
  ["Canh Cua", "addon", 10_000],
  ["Cơm Trắng", "addon", 10_000],
  ["Nước ép ổi", "drink", 25_000],
  ["Nước ép cam", "drink", 25_000],
];

const DEMO_PEOPLE = [
  { email: "an.demo@lunchtime.local", displayName: "Nguyễn Văn An" },
  { email: "binh.demo@lunchtime.local", displayName: "Trần Thị Bình" },
  { email: "chi.demo@lunchtime.local", displayName: "Lê Minh Chi" },
  { email: "dung.demo@lunchtime.local", displayName: "Phạm Tiến Dũng" },
  { email: "hoa.demo@lunchtime.local", displayName: "Vũ Thanh Hoa" },
];

/** Deterministic pseudo-randomness, so a re-run produces the same story. */
function seeded(n: number) {
  return (Math.sin(n * 12.9898) * 43758.5453) % 1;
}
const pick = <T,>(list: T[], n: number) => list[Math.floor(Math.abs(seeded(n)) * list.length)];

/** The admin accounts (ADMIN_EMAILS), left owing so the debt banner shows. */
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const today = todayServiceDate();

// Weekdays only — nobody orders office lunch on a Sunday.
const serviceDates: string[] = [];
for (let offset = DAYS_BACK; offset >= 0; offset--) {
  const date = shiftServiceDate(today, -offset);
  const weekday = parseServiceDate(date).getDay();
  if (weekday !== 0 && weekday !== 6) serviceDates.push(date);
}
const from = serviceDates[0];
const to = serviceDates[serviceDates.length - 1];

console.log(`\n── seeding ${serviceDates.length} weekdays, ${from} → ${to} ──`);

/* ── 1. clear only this window ──────────────────────────────────────────── */

const existingDays = await db
  .select({ id: menuDays.id })
  .from(menuDays)
  .where(and(gte(menuDays.serviceDate, from), lte(menuDays.serviceDate, to)));
const existingDayIds = existingDays.map((d) => d.id);

if (existingDayIds.length > 0) {
  await db.delete(payments).where(
    and(gte(payments.serviceDate, from), lte(payments.serviceDate, to)),
  );
  await db.delete(dayOrders).where(inArray(dayOrders.menuDayId, existingDayIds));
  await db.delete(bookings).where(inArray(bookings.menuDayId, existingDayIds));
  await db.delete(menuItems).where(inArray(menuItems.menuDayId, existingDayIds));
  await db.delete(menuDays).where(inArray(menuDays.id, existingDayIds));
  console.log(`   cleared ${existingDayIds.length} existing day(s) in range`);
}

/* ── 2. people: every real account, plus demo colleagues ────────────────── */

for (const person of DEMO_PEOPLE) {
  await db
    .insert(users)
    .values({ clerkUserId: `demo_${person.email}`, ...person })
    .onConflictDoNothing({ target: users.email });
}

const everyone = await db.select().from(users);
// Real accounts are the ones not created by this script.
const realPeople = everyone.filter((u) => !u.clerkUserId.startsWith("demo_"));
console.log(`   ${everyone.length} people (${realPeople.length} real, ${everyone.length - realPeople.length} demo)`);

/* ── 3. days, dishes, orders ────────────────────────────────────────────── */

let bookingCount = 0;

for (const [dayIndex, serviceDate] of serviceDates.entries()) {
  const isToday = serviceDate === today;

  const [day] = await db
    .insert(menuDays)
    .values({
      serviceDate,
      status: isToday ? "open" : "locked",
      setPriceVnd: SET_PRICE,
      shipFeeVnd: SHIP_FEE,
      // Late in the Vietnam evening, so the seeded menu stays bookable however
      // late you run this — a cutoff a few hours out expires mid-test. The
      // party below closes at 23:59, after this, as the rule requires.
      orderCutoff: isToday ? localInputToInstant(`${serviceDate}T23:00`) : null,
      note: "Thực đơn tự chọn · ĐT đặt món: 0900 000 000",
    })
    .returning();

  const dishes = await db
    .insert(menuItems)
    .values(
      DISHES.map(([name, category, priceVnd], index) => ({
        menuDayId: day.id,
        name,
        category,
        priceVnd,
        sortOrder: index,
      })),
    )
    .returning();

  const byCategory = (category: string) => dishes.filter((d) => d.category === category);

  for (const [personIndex, person] of everyone.entries()) {
    const roll = Math.abs(seeded(dayIndex * 31 + personIndex * 7));
    // Roughly one person in six skips any given day.
    if (roll < 0.17) continue;

    const chosen = [
      byCategory("main")[Math.floor(Math.abs(seeded(dayIndex + personIndex)) * 5)],
      byCategory("main")[
        (Math.floor(Math.abs(seeded(dayIndex * 3 + personIndex)) * 5) + 1) % 5
      ],
      pick(byCategory("side"), dayIndex * 5 + personIndex),
      pick(byCategory("veg"), dayIndex * 11 + personIndex),
    ].filter(Boolean);

    for (const dish of chosen) {
      await db
        .insert(bookings)
        .values({
          userId: person.id,
          menuDayId: day.id,
          menuItemId: dish.id,
          quantity: 1,
          unitPriceVnd: 0,
          status: "booked",
        })
        .onConflictDoNothing();
      bookingCount++;
    }

    // Now and then somebody adds a soup or a juice.
    if (roll > 0.72) {
      const extra = pick([...byCategory("addon"), ...byCategory("drink")], dayIndex + personIndex * 3);
      await db
        .insert(bookings)
        .values({
          userId: person.id,
          menuDayId: day.id,
          menuItemId: extra.id,
          quantity: 1,
          unitPriceVnd: extra.priceVnd,
          status: "booked",
        })
        .onConflictDoNothing();
      bookingCount++;
    }

    await syncDayOrder(person.id, day.id);
  }

  // Past days are locked, so their ship split is frozen like a real locked day.
  if (!isToday) await freezeShipDinerCount(day.id);
}

console.log(`   ${bookingCount} bookings across ${serviceDates.length} days`);

/* ── 3b. an afternoon party on today, beside the lunch menu ─────────────── */

// The second sitting a date can hold. Priced per dish rather than by suất —
// nobody buys a party in suất — so every item carries its own price and the
// menu has no món chính / phụ / rau at all.
const PARTY_DISHES: Array<[string, number]> = [
  ["Bánh kem", 250_000],
  ["Trà sữa", 35_000],
  ["Hoa quả dĩa", 80_000],
  ["Khô gà lá chanh", 60_000],
];

const [party] = await db
  .insert(menuDays)
  .values({
    serviceDate: today,
    slot: "afternoon",
    status: "open",
    setPriceVnd: 0,
    requiredMain: 0,
    requiredSide: 0,
    requiredVeg: 0,
    shipFeeVnd: 0,
    // Strictly after lunch's 23:00 — the party always closes last.
    orderCutoff: localInputToInstant(`${today}T23:59`),
    note: "Sinh nhật phòng — chiều nay 16h30",
  })
  .returning();

const partyItems = await db
  .insert(menuItems)
  .values(
    PARTY_DISHES.map(([name, priceVnd], index) => ({
      menuDayId: party.id,
      name,
      category: "addon" as const,
      priceVnd,
      sortOrder: index,
    })),
  )
  .returning();

let partyBookings = 0;
for (const [personIndex, person] of everyone.entries()) {
  // Roughly half the office joins the party.
  if (Math.abs(seeded(personIndex * 17 + 3)) < 0.5) continue;
  const dish = pick(partyItems, personIndex * 5);
  await db
    .insert(bookings)
    .values({
      userId: person.id,
      menuDayId: party.id,
      menuItemId: dish.id,
      quantity: 1,
      unitPriceVnd: dish.priceVnd,
      status: "booked",
    })
    .onConflictDoNothing();
  partyBookings++;
}

console.log(`   + tiệc chiều nay: ${PARTY_DISHES.length} món, ${partyBookings} người đặt`);

/* ── 4. payment states: a deliberate mix ────────────────────────────────── */

const settled = serviceDates.slice(0, Math.max(0, serviceDates.length - 4));
const [pendingDate, rejectedDate] = serviceDates.slice(-4, -2);

let paid = 0;
for (const person of everyone) {
  const isAdminAccount = adminEmails.includes(person.email.toLowerCase());

  // The admin account is deliberately left owing, so the "bạn còn nợ" banner
  // and the unpaid cells are visible the moment you open the app.
  if (isAdminAccount) continue;

  const behaviour = Math.abs(seeded(person.id.charCodeAt(0) + person.email.length));

  // One person in five never settles anything — that is the case being tested.
  if (behaviour < 0.2) continue;

  const claimId = randomUUID();
  for (const serviceDate of settled) {
    const orders = await db
      .select({ id: dayOrders.id })
      .from(dayOrders)
      .innerJoin(menuDays, eq(menuDays.id, dayOrders.menuDayId))
      .where(and(eq(dayOrders.userId, person.id), eq(menuDays.serviceDate, serviceDate)));
    if (orders.length === 0) continue;

    await db
      .insert(payments)
      .values({
        userId: person.id,
        serviceDate,
        amountVnd: SET_PRICE,
        status: "confirmed",
        claimId,
        confirmedAt: new Date(),
        note: "Seed: đã đối chiếu",
      })
      .onConflictDoNothing();
    paid++;
  }

  // A couple of people are mid-flight: claimed but not yet checked, or bounced.
  if (behaviour > 0.75 && pendingDate) {
    await db
      .insert(payments)
      .values({
        userId: person.id,
        serviceDate: pendingDate,
        amountVnd: SET_PRICE,
        status: "pending",
        claimId: randomUUID(),
        note: "Seed: em chuyển rồi ạ",
      })
      .onConflictDoNothing();
  } else if (behaviour > 0.6 && rejectedDate) {
    await db
      .insert(payments)
      .values({
        userId: person.id,
        serviceDate: rejectedDate,
        amountVnd: SET_PRICE,
        status: "rejected",
        claimId: randomUUID(),
        note: "Seed: không thấy giao dịch",
      })
      .onConflictDoNothing();
  }
}

console.log(`   ${paid} days marked paid; the rest left unpaid / pending / rejected`);

/* ── 5. what you should now see ─────────────────────────────────────────── */

const { getUserLedger } = await import("../src/db/queries/payments.js");
const { settleableEntries } = await import("../src/db/queries/payments.js");

console.log("\n── what each account owes right now ──");
for (const person of realPeople) {
  const ledger = await getUserLedger(person.id, from, to);
  const owing = settleableEntries(ledger);
  const total = owing.reduce((sum, entry) => sum + entry.owedVnd, 0);
  console.log(
    `   ${(person.displayName ?? person.email).padEnd(18)} ${String(owing.length).padStart(2)} ngày chưa trả · ${formatVnd(total)}`,
  );
}

console.log("\n✓ done — open the app and check the amber banner on the home page.\n");
process.exit(0);
