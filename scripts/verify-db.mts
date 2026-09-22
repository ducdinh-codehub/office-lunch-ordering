/**
 * End-to-end check of the data layer against a real Postgres.
 * Run with: DATABASE_URL=... npx tsx verify.mts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { menuDays, menuItems, users, bookings, payments, dayOrders } from "../src/db/schema.js";
import { getMenuDay } from "../src/db/queries/menu.js";
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

const aliceD3 = await getUserBookingsForDay(alice.id, D3);
check("per-day line totals", aliceD3.map(l => l.lineTotalVnd), [120000, 55000]);

const aliceTotals = await getUserDailyTotals(alice.id, D1, D3);
check("daily totals (desc)", aliceTotals, [
  { serviceDate: D3, totalVnd: 175000, itemCount: 3, hasSet: false, shipVnd: 0 },
  { serviceDate: D2, totalVnd: 50000, itemCount: 1, hasSet: false, shipVnd: 0 },
  { serviceDate: D1, totalVnd: 45000, itemCount: 1, hasSet: false, shipVnd: 0 },
]);

const bobTotals = await getUserDailyTotals(bob.id, D1, D3);
check("cancelled bookings excluded", bobTotals, [{ serviceDate: D3, totalVnd: 60000, itemCount: 1, hasSet: false, shipVnd: 0 }]);

const kitchen = await getKitchenSummary(D3);
check("kitchen headcount", kitchen.map(k => [k.itemName, k.totalQuantity]), [["Phở bò", 3], ["Cơm tấm", 1]]);

const kitchenD1 = await getKitchenSummary(D1);
check("kitchen ignores cancelled", kitchenD1.map(k => k.totalQuantity), [1]);

const people = await getDayBookingsByPerson(D3);
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
check("charged 40k", (await getDayOrdersByPerson(D4)).map(o => [o.setTier, o.setPriceVnd]), [["alt", 40000]]);

await pick("Cá chiên");
await syncDayOrder(alice.id, d4.id);
check("2nd main moves them to the 50k suất", (await getDayOrdersByPerson(D4)).map(o => [o.setTier, o.setPriceVnd]), [["full", 50000]]);
check("the day's total follows the suất", (await getUserTotalsForDates(alice.id, [D4])).get(D4), 50000);

// A price edit must not move a bill someone already has — only a change of suất does.
await db.update(menuDays).set({ setPriceVnd: 70000 }).where(eq(menuDays.id, d4.id));
await syncDayOrder(alice.id, d4.id);
check("re-pricing the day leaves the existing bill alone", (await getDayOrdersByPerson(D4)).map(o => o.setPriceVnd), [50000]);

await db.delete(bookings).where(eq(bookings.menuItemId, dish("Cá chiên").id));
await syncDayOrder(alice.id, d4.id);
check("dropping back to 1 main returns to 40k", (await getDayOrdersByPerson(D4)).map(o => [o.setTier, o.setPriceVnd]), [["alt", 40000]]);

await db.delete(bookings).where(eq(bookings.menuItemId, dish("Rau luộc").id));
check("an incomplete selection is no suất", await syncDayOrder(alice.id, d4.id), { complete: false });
check("and is billed nothing", (await db.select().from(dayOrders).where(eq(dayOrders.menuDayId, d4.id))).length, 0);

console.log("\n── settings seed from env ──");
const settings = await getAppSettings();
check("settings row is created on first read", settings.id, "default");
check("qr template default", settings.qrTemplate, "compact2");
const again = await getAppSettings();
check("second read is stable", again.id, "default");

console.log(failures === 0 ? "\n✅ all data-layer checks passed\n" : `\n❌ ${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
