/**
 * End-to-end check of the data layer against a real Postgres.
 * Run with: DATABASE_URL=... npx tsx verify.mts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { menuDays, menuItems, users, bookings, payments, dayOrders, luckyEnvelopes } from "../src/db/schema.js";
import { drawLuckyPercent } from "../src/lib/lucky-envelope.js";
import { discountVnd } from "../src/lib/day-discount.js";
import { birthdayField, birthdayInYear, birthdaysBetween, isBirthdayOn } from "../src/lib/birthday.js";
import { getMenuDay, getMenuDaysForDate } from "../src/db/queries/menu.js";
import { cutoffOrderError, resolveActiveSlot } from "../src/lib/menu-slot.js";
import { getUserBookingsForDay, getUserDailyTotals, getKitchenSummary, getDayBookingsByPerson, getUserTotalsForDates, getDayOrdersByPerson, syncDayOrder } from "../src/db/queries/bookings.js";
import { getUserLedger, getPaymentRoster, getPendingClaims } from "../src/db/queries/payments.js";
import { getAppSettings } from "../src/db/queries/settings.js";
import { randomUUID } from "node:crypto";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ✓ ${label}`);
  else { failures++; console.log(`  ✗ ${label}\n      expected ${e}\n      got      ${a}`); }
}

const D1 = "2026-09-14", D2 = "2026-09-15", D3 = "2026-09-16";

console.log("\n── seeding ──");
await db.delete(payments); await db.delete(bookings);
await db.delete(menuItems); await db.delete(menuDays); await db.delete(users);

const [alice, bob, admin] = await db.insert(users).values([
  { clerkUserId: "user_alice", email: "alice@example.com", displayName: "Alice Nguyen" },
  { clerkUserId: "user_bob", email: "bob@example.com", displayName: "Bob Tran" },
  { clerkUserId: "user_admin", email: "admin@example.com", displayName: "Admin" },
]).returning();

const days = await db.insert(menuDays).values([
  { serviceDate: D1, status: "locked" },
  { serviceDate: D2, status: "locked" },
  { serviceDate: D3, status: "open", orderCutoff: new Date(Date.now() + 3600_000) },
]).returning();
const byDate = new Map(days.map(d => [d.serviceDate, d]));

const items = await db.insert(menuItems).values([
  { menuDayId: byDate.get(D1)!.id, name: "Cơm gà", priceVnd: 45000, sortOrder: 0 },
  { menuDayId: byDate.get(D2)!.id, name: "Bún bò", priceVnd: 50000, sortOrder: 0 },
  { menuDayId: byDate.get(D3)!.id, name: "Phở bò", priceVnd: 60000, sortOrder: 0 },
  { menuDayId: byDate.get(D3)!.id, name: "Cơm tấm", priceVnd: 55000, sortOrder: 1 },
]).returning();
const item = (n: string) => items.find(i => i.name === n)!;

await db.insert(bookings).values([
  // Alice: D1 1x45k, D2 1x50k, D3 2x60k + 1x55k = 175k
  { userId: alice.id, menuDayId: byDate.get(D1)!.id, menuItemId: item("Cơm gà").id, quantity: 1, unitPriceVnd: 45000 },
  { userId: alice.id, menuDayId: byDate.get(D2)!.id, menuItemId: item("Bún bò").id, quantity: 1, unitPriceVnd: 50000 },
  { userId: alice.id, menuDayId: byDate.get(D3)!.id, menuItemId: item("Phở bò").id, quantity: 2, unitPriceVnd: 60000 },
  { userId: alice.id, menuDayId: byDate.get(D3)!.id, menuItemId: item("Cơm tấm").id, quantity: 1, unitPriceVnd: 55000 },
  // Bob: D3 1x60k, plus a CANCELLED D1 row that must be ignored everywhere
  { userId: bob.id, menuDayId: byDate.get(D3)!.id, menuItemId: item("Phở bò").id, quantity: 1, unitPriceVnd: 60000 },
  { userId: bob.id, menuDayId: byDate.get(D1)!.id, menuItemId: item("Cơm gà").id, quantity: 3, unitPriceVnd: 45000, status: "cancelled" },
]);

console.log("\n── reads ──");
const menu = await getMenuDay(D3);
check("menu day loads with items in sort order", menu?.items.map(i => i.name), ["Phở bò", "Cơm tấm"]);

const aliceD3 = await getUserBookingsForDay(alice.id, byDate.get(D3)!.id);
check("per-day line totals", aliceD3.map(l => l.lineTotalVnd), [120000, 55000]);

const aliceTotals = await getUserDailyTotals(alice.id, D1, D3);
check("daily totals (desc)", aliceTotals, [
  { serviceDate: D3, totalVnd: 175000, itemCount: 3, setCount: 0, incompleteSet: false, shipVnd: 0, discountVnd: 0, luckyPercent: null, birthday: false },
  { serviceDate: D2, totalVnd: 50000, itemCount: 1, setCount: 0, incompleteSet: false, shipVnd: 0, discountVnd: 0, luckyPercent: null, birthday: false },
  { serviceDate: D1, totalVnd: 45000, itemCount: 1, setCount: 0, incompleteSet: false, shipVnd: 0, discountVnd: 0, luckyPercent: null, birthday: false },
]);

const bobTotals = await getUserDailyTotals(bob.id, D1, D3);
check("cancelled bookings excluded", bobTotals, [{ serviceDate: D3, totalVnd: 60000, itemCount: 1, setCount: 0, incompleteSet: false, shipVnd: 0, discountVnd: 0, luckyPercent: null, birthday: false }]);

const kitchen = await getKitchenSummary(byDate.get(D3)!.id);
check("kitchen headcount", kitchen.map(k => [k.itemName, k.totalQuantity]), [["Phở bò", 3], ["Cơm tấm", 1]]);

const kitchenD1 = await getKitchenSummary(byDate.get(D1)!.id);
check("kitchen ignores cancelled", kitchenD1.map(k => k.totalQuantity), [1]);

const people = await getDayBookingsByPerson(byDate.get(D3)!.id);
check("per-person rows on D3", people.length, 3);

console.log("\n── ledger before payment ──");
let ledger = await getUserLedger(alice.id, D1, D3);
check("all days unpaid", ledger.map(e => [e.serviceDate, e.owedVnd, e.state]),
  [[D3, 175000, "unpaid"], [D2, 50000, "unpaid"], [D1, 45000, "unpaid"]]);

console.log("\n── claim (one transfer covering D1+D2) ──");
const totals = await getUserTotalsForDates(alice.id, [D1, D2]);
check("recomputed totals for claim", [...totals.entries()].sort(), [[D1, 45000], [D2, 50000]]);

const claimId = randomUUID();
await db.insert(payments).values([D1, D2].map(d => ({
  userId: alice.id, serviceDate: d, amountVnd: totals.get(d)!, status: "pending" as const, claimId,
})));

ledger = await getUserLedger(alice.id, D1, D3);
check("D1/D2 now pending", ledger.map(e => e.state), ["unpaid", "pending", "pending"]);

const claims = await getPendingClaims();
check("one grouped pending claim", claims.length, 1);
check("claim total is the sum of its days", claims[0].totalVnd, 95000);
check("claim lists both dates", claims[0].serviceDates.sort(), [D1, D2]);

console.log("\n── roster ──");
let roster = await getPaymentRoster(D1, D3);
check("roster dates", roster.dates, [D1, D2, D3]);
check("roster has both bookers", roster.rows.length, 2);
const aliceRow = roster.rows.find(r => r.email === "alice@example.com")!;
check("alice billed total", aliceRow.totalOwedVnd, 270000);
check("alice pending", aliceRow.pendingVnd, 95000);
check("alice outstanding", aliceRow.outstandingVnd, 175000);
check("alice not fully settled", aliceRow.fullySettled, false);
const bobRow = roster.rows.find(r => r.email === "bob@example.com")!;
check("bob has one cell only", [...bobRow.cells.keys()], [D3]);

console.log("\n── admin confirms the claim ──");
await db.update(payments).set({ status: "confirmed", confirmedAt: new Date(), confirmedByUserId: admin.id })
  .where(eq(payments.claimId, claimId));

roster = await getPaymentRoster(D1, D3);
const aliceAfter = roster.rows.find(r => r.email === "alice@example.com")!;
check("confirmed moves out of pending", [aliceAfter.confirmedVnd, aliceAfter.pendingVnd], [95000, 0]);
check("still owes D3", aliceAfter.outstandingVnd, 175000);
check("pending queue is empty", (await getPendingClaims()).length, 0);

console.log("\n── re-claim a rejected day uses the fresh amount ──");
await db.update(payments).set({ status: "rejected" }).where(eq(payments.serviceDate, D1));
// Price on D1 changes; the SNAPSHOT on the booking must keep the bill at 45k.
await db.update(menuItems).set({ priceVnd: 99000 }).where(eq(menuItems.id, item("Cơm gà").id));
const afterPriceChange = await getUserTotalsForDates(alice.id, [D1]);
check("price snapshot protects the old bill", afterPriceChange.get(D1), 45000);

const claim2 = randomUUID();
const t2 = await getUserTotalsForDates(alice.id, [D1, D3]);
await db.insert(payments).values([D1, D3].map(d => ({
  userId: alice.id, serviceDate: d, amountVnd: t2.get(d)!, status: "pending" as const, claimId: claim2,
}))).onConflictDoUpdate({
  target: [payments.userId, payments.serviceDate],
  set: { amountVnd: (await import("drizzle-orm")).sql`excluded.amount_vnd`, status: "pending", claimId: claim2, claimedAt: new Date(), confirmedAt: null, confirmedByUserId: null },
});
const reclaimed = await db.select().from(payments).where(eq(payments.serviceDate, D1));
check("rejected row re-claimed via upsert", [reclaimed[0].status, reclaimed[0].amountVnd, reclaimed[0].claimId === claim2], ["pending", 45000, true]);

ledger = await getUserLedger(alice.id, D1, D3);
check("ledger after re-claim", ledger.map(e => [e.serviceDate, e.state]), [[D3, "pending"], [D2, "confirmed"], [D1, "pending"]]);

console.log("\n── two suất on one day ──");
// D4 sells 2+1+1 at 50k and 1+1+1 at 40k. Which suất a diner is on is decided by
// how many món chính they took, so the same dishes must price two different ways.
const D4 = "2026-09-17";
const [d4] = await db.insert(menuDays).values({
  serviceDate: D4, status: "open", orderCutoff: new Date(Date.now() + 3600_000),
  setPriceVnd: 50000, requiredMain: 2, requiredSide: 1, requiredVeg: 1,
  altSetPriceVnd: 40000, altRequiredMain: 1, altRequiredSide: 1, altRequiredVeg: 1,
}).returning();

const setDishes = await db.insert(menuItems).values([
  { menuDayId: d4.id, name: "Gà kho", category: "main" as const, priceVnd: 0, sortOrder: 0 },
  { menuDayId: d4.id, name: "Cá chiên", category: "main" as const, priceVnd: 0, sortOrder: 1 },
  { menuDayId: d4.id, name: "Trứng chiên", category: "side" as const, priceVnd: 0, sortOrder: 2 },
  { menuDayId: d4.id, name: "Rau luộc", category: "veg" as const, priceVnd: 0, sortOrder: 3 },
]).returning();
const dish = (n: string) => setDishes.find(i => i.name === n)!;
const pick = (n: string) => db.insert(bookings).values({
  userId: alice.id, menuDayId: d4.id, menuItemId: dish(n).id, quantity: 1, unitPriceVnd: 0,
});

await pick("Gà kho"); await pick("Trứng chiên"); await pick("Rau luộc");
check("1 main completes the cheaper suất", await syncDayOrder(alice.id, d4.id), { complete: true });
check("charged 40k", (await getDayOrdersByPerson(d4.id)).map(o => [o.setTier, o.setPriceVnd]), [["alt", 40000]]);

await pick("Cá chiên");
await syncDayOrder(alice.id, d4.id);
check("2nd main moves them to the 50k suất", (await getDayOrdersByPerson(d4.id)).map(o => [o.setTier, o.setPriceVnd]), [["full", 50000]]);
check("the day's total follows the suất", (await getUserTotalsForDates(alice.id, [D4])).get(D4), 50000);

// A price edit must not move a bill someone already has — only a change of suất does.
await db.update(menuDays).set({ setPriceVnd: 70000 }).where(eq(menuDays.id, d4.id));
await syncDayOrder(alice.id, d4.id);
check("re-pricing the day leaves the existing bill alone", (await getDayOrdersByPerson(d4.id)).map(o => o.setPriceVnd), [50000]);

await db.delete(bookings).where(eq(bookings.menuItemId, dish("Cá chiên").id));
await syncDayOrder(alice.id, d4.id);
check("dropping back to 1 main returns to 40k", (await getDayOrdersByPerson(d4.id)).map(o => [o.setTier, o.setPriceVnd]), [["alt", 40000]]);

await db.delete(bookings).where(eq(bookings.menuItemId, dish("Rau luộc").id));
check("an incomplete selection is no suất", await syncDayOrder(alice.id, d4.id), { complete: false });
check("and is billed nothing", (await db.select().from(dayOrders).where(eq(dayOrders.menuDayId, d4.id))).length, 0);

// D4 was left with 1 món chính + 1 món phụ and no rau — a started suất that
// completes no tier. That, and only that, is what the warning is for.
const d4Totals = await getUserDailyTotals(alice.id, D4, D4);
check("a started-but-short suất is flagged", d4Totals[0].incompleteSet, true);
check("...and is billed nothing", d4Totals[0].setCount, 0);

console.log("\n── two menus on one date (lunch + afternoon party) ──");
// The rule the slot column exists to protect: the two menus are separate orders
// to the quán, but a single amount to settle. Splitting the first or merging the
// second would each be a correctness bug.
const D5 = "2026-09-18";
const [lunch] = await db.insert(menuDays).values({
  serviceDate: D5, slot: "lunch", status: "open",
  orderCutoff: new Date(Date.now() + 3600_000), shipFeeVnd: 20000,
}).returning();
const [party] = await db.insert(menuDays).values({
  serviceDate: D5, slot: "afternoon", status: "open",
  orderCutoff: new Date(Date.now() + 3600_000), shipFeeVnd: 30000,
}).returning();

check("a date holds one menu per sitting", [lunch.slot, party.slot], ["lunch", "afternoon"]);
check("getMenuDay defaults to lunch", (await getMenuDay(D5))?.id, lunch.id);
check("...and finds the party when asked", (await getMenuDay(D5, "afternoon"))?.id, party.id);
check("both sittings listed, lunch first", (await getMenuDaysForDate(D5)).map(d => d.slot), ["lunch", "afternoon"]);

let duplicateRefused = false;
try {
  await db.insert(menuDays).values({ serviceDate: D5, slot: "afternoon", status: "draft" });
} catch {
  duplicateRefused = true;
}
check("a third menu on the date is refused", duplicateRefused, true);

const [lunchDish] = await db.insert(menuItems).values(
  { menuDayId: lunch.id, name: "Cơm trưa", priceVnd: 60000, sortOrder: 0 },
).returning();
const [partyDish] = await db.insert(menuItems).values(
  { menuDayId: party.id, name: "Bánh kem", priceVnd: 200000, sortOrder: 0 },
).returning();

await db.insert(bookings).values([
  { userId: alice.id, menuDayId: lunch.id, menuItemId: lunchDish.id, quantity: 1, unitPriceVnd: 60000 },
  { userId: alice.id, menuDayId: party.id, menuItemId: partyDish.id, quantity: 1, unitPriceVnd: 200000 },
]);

check("the lunch kitchen list holds only lunch",
  (await getKitchenSummary(lunch.id)).map(k => k.itemName), ["Cơm trưa"]);
check("the party kitchen list holds only the party",
  (await getKitchenSummary(party.id)).map(k => k.itemName), ["Bánh kem"]);
check("per-person rows stay with their own sitting",
  [(await getDayBookingsByPerson(lunch.id)).length, (await getDayBookingsByPerson(party.id)).length], [1, 1]);
check("a diner's lines are scoped to one menu",
  (await getUserBookingsForDay(alice.id, lunch.id)).map(l => l.itemName), ["Cơm trưa"]);

// 60k + 200k food, plus both delivery fees — Alice is the only diner on each.
const d5Totals = await getUserDailyTotals(alice.id, D5, D5);
check("the date bills as one amount", d5Totals, [
  { serviceDate: D5, totalVnd: 310000, itemCount: 2, setCount: 0, incompleteSet: false, shipVnd: 50000, discountVnd: 0, luckyPercent: null, birthday: false },
]);
// The bug this guards: à-la-carte dishes are not an unfinished suất. A party
// menu has no suất at all, so nothing on this date is "chưa đủ món".
check("per-dish bookings are not a half-finished suất", d5Totals[0].incompleteSet, false);
check("both delivery fees are counted", d5Totals[0].shipVnd, 50000);
check("a claim for the date covers both sittings",
  (await getUserTotalsForDates(alice.id, [D5])).get(D5), 310000);
check("the ledger shows one row for the date",
  (await getUserLedger(alice.id, D5, D5)).map(e => [e.serviceDate, e.owedVnd, e.state]),
  [[D5, 310000, "unpaid"]]);

console.log("\n── locking lunch hands the day to the party ──");
// Which menu a link with no `buoi` lands on. Lunch owns the day until the admin
// locks it; only then, and only if the party is already published, does the
// party take over.
check("lunch owns the day while it is open",
  resolveActiveSlot(await getMenuDaysForDate(D5)), "lunch");

await db.update(menuDays).set({ status: "locked" }).where(eq(menuDays.id, lunch.id));
check("locked lunch + open party hands the day over",
  resolveActiveSlot(await getMenuDaysForDate(D5)), "afternoon");

await db.update(menuDays).set({ status: "draft" }).where(eq(menuDays.id, party.id));
check("a party still in draft does not take over",
  resolveActiveSlot(await getMenuDaysForDate(D5)), "lunch");

await db.update(menuDays).set({ status: "open" }).where(eq(menuDays.id, party.id));
await db.update(menuDays).set({ status: "open" }).where(eq(menuDays.id, lunch.id));
check("re-opening lunch takes the day back",
  resolveActiveSlot(await getMenuDaysForDate(D5)), "lunch");

check("a date with lunch alone is unaffected",
  resolveActiveSlot(await getMenuDaysForDate(D3)), "lunch");

console.log("\n── the party closes after lunch ──");
// The party's deadline must come strictly later than lunch's. `upsertMenuDay`
// applies this to whichever sitting is being saved, so neither can be edited
// past the other; the ordering itself is the pure rule checked here.
const at = (hhmm: string) => new Date(`2026-09-18T${hhmm}:00+07:00`);
const ok = (a: Date | null, b: Date | null) => cutoffOrderError(a, b) === null;

check("a party deadline after lunch is accepted", ok(at("10:00"), at("17:00")), true);
check("a party deadline before lunch is refused", ok(at("10:00"), at("09:00")), false);
check("a party deadline equal to lunch is refused", ok(at("10:00"), at("10:00")), false);
check("one minute later is enough", ok(at("10:00"), at("10:01")), true);
check("no lunch deadline constrains nothing", ok(null, at("09:00")), true);
check("no party deadline is not an early one", ok(at("10:00"), null), true);

console.log("\n── lì xì may mắn ──");
// The odds: a roll of 0–99 lands 65 / 30 / 5 on 5% / 10% / 20%.
const tally: Record<number, number> = {};
for (let roll = 0; roll < 100; roll++) {
  const p = drawLuckyPercent(roll);
  tally[p] = (tally[p] ?? 0) + 1;
}
check("odds are 65 / 30 / 5", tally, { 5: 65, 10: 30, 20: 5 });
check("the boundaries land where the weights say",
  [0, 64, 65, 94, 95, 99].map(drawLuckyPercent), [5, 5, 10, 10, 20, 20]);
check("the discount rounds down to the đồng", discountVnd(99_999, 5), 4999);
check("nothing owed, nothing taken", discountVnd(0, 20), 0);

await db.delete(luckyEnvelopes);
const luckyAliceBefore = (await getUserTotalsForDates(alice.id, [D3])).get(D3)!;
const luckyBobBefore = (await getUserTotalsForDates(bob.id, [D3])).get(D3)!;
const luckyAliceAfter = luckyAliceBefore - discountVnd(luckyAliceBefore, 10);

const [firstOpen] = await db.insert(luckyEnvelopes)
  .values({ userId: alice.id, serviceDate: D3, percent: 10 })
  .onConflictDoNothing({ target: luckyEnvelopes.userId }).returning();
check("the first envelope opens", Boolean(firstOpen), true);
const secondOpen = await db.insert(luckyEnvelopes)
  .values({ userId: alice.id, serviceDate: D1, percent: 20 })
  .onConflictDoNothing({ target: luckyEnvelopes.userId }).returning();
check("a second envelope for the same person is refused", secondOpen.length, 0);

let badPercent = false;
try {
  await db.insert(luckyEnvelopes).values({ userId: bob.id, serviceDate: D3, percent: 7 });
} catch { badPercent = true; }
check("only 5, 10 or 20 can be stored", badPercent, true);

// Every total agrees on the discounted amount.
check("claim total is discounted", (await getUserTotalsForDates(alice.id, [D3])).get(D3), luckyAliceAfter);
const luckyDay = (await getUserDailyTotals(alice.id, D3, D3))[0];
check("bookings total is discounted, and says by how much",
  [luckyDay.totalVnd, luckyDay.luckyPercent, luckyDay.discountVnd],
  [luckyAliceAfter, 10, luckyAliceBefore - luckyAliceAfter]);
check("ledger owes the discounted amount",
  (await getUserLedger(alice.id, D3, D3)).map(e => [e.owedVnd, e.luckyPercent]), [[luckyAliceAfter, 10]]);
const luckyRoster = await getPaymentRoster(D3, D3);
check("roster agrees",
  luckyRoster.rows.find(r => r.userId === alice.id)?.cells.get(D3)?.owedVnd, luckyAliceAfter);
check("only the opener's day is discounted",
  (await getUserTotalsForDates(bob.id, [D3])).get(D3), luckyBobBefore);
check("…and only on the day it was opened",
  (await getUserDailyTotals(alice.id, D1, D1))[0]?.luckyPercent ?? null, null);

// Resetting deletes every envelope: full price again.
await db.delete(luckyEnvelopes);
check("a wiped envelope restores the full price",
  (await getUserTotalsForDates(alice.id, [D3])).get(D3), luckyAliceBefore);
const [reopened] = await db.insert(luckyEnvelopes)
  .values({ userId: alice.id, serviceDate: D3, percent: 5 })
  .onConflictDoNothing({ target: luckyEnvelopes.userId }).returning();
check("after a wipe the same person can open again", Boolean(reopened), true);
await db.delete(luckyEnvelopes);

console.log("\n── sinh nhật ──");
check("a leap-day birthday is itself in a leap year", birthdayInYear({ month: 2, day: 29 }, 2028), "2028-02-29");
check("…and 28 February otherwise", birthdayInYear({ month: 2, day: 29 }, 2027), "2027-02-28");
check("any other birthday is its own date", isBirthdayOn({ month: 9, day: 16 }, D3), true);
check("no birthday is never a birthday", isBirthdayOn(null, D3), false);
check("a range across new year finds one per year",
  birthdaysBetween({ month: 1, day: 2 }, "2026-12-01", "2027-01-31"), ["2027-01-02"]);
check("a range spanning years finds each",
  birthdaysBetween({ month: 6, day: 1 }, "2025-01-01", "2026-12-31"), ["2025-06-01", "2026-06-01"]);
check("31 February is refused", birthdayField.safeParse({ month: 2, day: 31 }).success, false);
check("29 February is accepted", birthdayField.safeParse({ month: 2, day: 29 }).success, true);

let halfBirthday = false;
try {
  await db.update(users).set({ birthMonth: 9 }).where(eq(users.id, bob.id));
} catch { halfBirthday = true; }
check("a month without a day is refused", halfBirthday, true);
let badMonth = false;
try {
  await db.update(users).set({ birthMonth: 13, birthDay: 1 }).where(eq(users.id, bob.id));
} catch { badMonth = true; }
check("month 13 is refused", badMonth, true);

const bdayAliceBefore = (await getUserTotalsForDates(alice.id, [D3])).get(D3)!;
const bdayBobBefore = (await getUserTotalsForDates(bob.id, [D3])).get(D3)!;
const bdayAliceAfter = bdayAliceBefore - discountVnd(bdayAliceBefore, 10);
await db.update(users).set({ birthMonth: 9, birthDay: 16 }).where(eq(users.id, alice.id));

check("claim total is 10% off on the birthday", (await getUserTotalsForDates(alice.id, [D3])).get(D3), bdayAliceAfter);
const bdayDay = (await getUserDailyTotals(alice.id, D3, D3))[0];
check("bookings total says it is the birthday, and by how much",
  [bdayDay.totalVnd, bdayDay.birthday, bdayDay.luckyPercent, bdayDay.discountVnd],
  [bdayAliceAfter, true, null, bdayAliceBefore - bdayAliceAfter]);
check("ledger owes the discounted amount",
  (await getUserLedger(alice.id, D3, D3)).map(e => [e.owedVnd, e.birthday]), [[bdayAliceAfter, true]]);
check("roster agrees",
  (await getPaymentRoster(D3, D3)).rows.find(r => r.userId === alice.id)?.cells.get(D3)?.owedVnd, bdayAliceAfter);
check("someone else's birthday is not yours",
  (await getUserTotalsForDates(bob.id, [D3])).get(D3), bdayBobBefore);
check("…and only on the day itself",
  (await getUserDailyTotals(alice.id, D1, D1))[0]?.birthday ?? null, false);

// A lì xì on the birthday adds to it: 20% + 10% = 30%, rounded once.
await db.insert(luckyEnvelopes).values({ userId: alice.id, serviceDate: D3, percent: 20 });
const stacked = bdayAliceBefore - discountVnd(bdayAliceBefore, 30);
check("a lì xì on the birthday adds up", (await getUserTotalsForDates(alice.id, [D3])).get(D3), stacked);
const stackedDay = (await getUserDailyTotals(alice.id, D3, D3))[0];
check("…and both are named",
  [stackedDay.totalVnd, stackedDay.luckyPercent, stackedDay.birthday], [stacked, 20, true]);
check("roster agrees on the sum",
  (await getPaymentRoster(D3, D3)).rows.find(r => r.userId === alice.id)?.cells.get(D3)?.owedVnd, stacked);
await db.delete(luckyEnvelopes);

// Cleared by the admin: full price again.
await db.update(users).set({ birthMonth: null, birthDay: null }).where(eq(users.id, alice.id));
check("a cleared birthday restores the full price",
  (await getUserTotalsForDates(alice.id, [D3])).get(D3), bdayAliceBefore);

console.log("\n── settings seed from env ──");
const settings = await getAppSettings();
check("settings row is created on first read", settings.id, "default");
check("qr template default", settings.qrTemplate, "compact2");
const again = await getAppSettings();
check("second read is stable", again.id, "default");

console.log(failures === 0 ? "\n✅ all data-layer checks passed\n" : `\n❌ ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
