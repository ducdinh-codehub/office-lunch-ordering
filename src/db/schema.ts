import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ────────────────────────────────── enums ────────────────────────────────── */

export const menuDayStatus = pgEnum("menu_day_status", [
  "draft", // being prepared, invisible to users
  "open", // users can book
  "locked", // cutoff passed, order sent to the kitchen
]);

export const bookingStatus = pgEnum("booking_status", ["booked", "cancelled"]);

/**
 * Which suất a diner took. A day offers one by default; `alt` is the optional
 * second option — typically the same meal with fewer món chính for less money.
 */
export const setTier = pgEnum("set_tier", ["full", "alt"]);

/**
 * Where a dish sits in the menu. The first three make up the fixed-price set
 * (suất): the diner picks a required number from each and the set price covers
 * them, so their `price_vnd` is always 0. `addon` and `drink` are charged per
 * portion on top, and those are the only categories that contribute a per-item
 * amount to a bill.
 */
export const menuItemCategory = pgEnum("menu_item_category", [
  "main", // Món chính
  "side", // Món phụ
  "veg", // Món rau
  "addon", // Gọi thêm — priced per portion
  "drink", // Đồ uống — priced per portion
]);

/** Categories whose dishes are covered by the set price rather than billed. */
export const SET_CATEGORIES = ["main", "side", "veg"] as const;
/** Categories billed per portion. */
export const PAID_CATEGORIES = ["addon", "drink"] as const;

export type SetCategory = (typeof SET_CATEGORIES)[number];
export type MenuItemCategory = (typeof menuItemCategory.enumValues)[number];

export const paymentStatus = pgEnum("payment_status", [
  "pending", // user says they transferred, admin has not checked yet
  "confirmed", // admin saw the money
  "rejected", // admin could not find the transfer
]);

/* ────────────────────────────────── users ────────────────────────────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Clerk owns identity; this is the join key back to it.
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────── menu days ──────────────────────────────── */

export const menuDays = pgTable("menu_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  // One menu per calendar day, interpreted in Asia/Ho_Chi_Minh.
  serviceDate: date("service_date").notNull().unique(),
  status: menuDayStatus("status").notNull().default("draft"),
  // After this instant no booking or cancellation is accepted. Null = no cutoff.
  orderCutoff: timestamp("order_cutoff", { withTimezone: true }),
  // What one suất costs today, quoted by the restaurant (45k–100k in practice).
  // Snapshotted onto `day_orders` the moment someone completes a set.
  setPriceVnd: integer("set_price_vnd").notNull().default(0),
  // How many dishes a complete set takes from each set category. The house
  // default is 2 mains + 1 side + 1 vegetable, but a day may differ.
  requiredMain: integer("required_main").notNull().default(2),
  requiredSide: integer("required_side").notNull().default(1),
  requiredVeg: integer("required_veg").notNull().default(1),
  // The optional second suất: its own price and its own required counts, e.g.
  // 1 món chính at 40k beside the 2 at 50k above. It is on offer only when it
  // asks for at least one dish — 0/0/0, the default, means one suất only.
  altSetPriceVnd: integer("alt_set_price_vnd").notNull().default(0),
  altRequiredMain: integer("alt_required_main").notNull().default(0),
  altRequiredSide: integer("alt_required_side").notNull().default(0),
  altRequiredVeg: integer("alt_required_veg").notNull().default(0),
  // One delivery fee for the whole order, split equally between that day's
  // diners. 0 means no fee.
  shipFeeVnd: integer("ship_fee_vnd").notNull().default(0),
  // Headcount the fee was divided by, written once the day is locked. While a
  // day is open each share is recomputed live from the current diners; locking
  // freezes it so a bill someone already has can never move afterwards.
  shipDinerCount: integer("ship_diner_count"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────── menu items ─────────────────────────────── */

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    menuDayId: uuid("menu_day_id")
      .notNull()
      .references(() => menuDays.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: menuItemCategory("category").notNull().default("addon"),
    // Vietnamese Dong has no minor unit, so a plain integer is exact.
    // Always 0 for the set categories — those are covered by the set price.
    priceVnd: integer("price_vnd").notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("menu_items_menu_day_idx").on(t.menuDayId),
    index("menu_items_day_category_idx").on(t.menuDayId, t.category),
  ],
);

/* ──────────────────────────────── day orders ─────────────────────────────── */

/**
 * One row per person per day, created only once their set is complete — i.e.
 * they picked the required number of dishes from every set category. Its
 * absence means "no suất today", so an unfinished selection is never billed.
 *
 * `setPriceVnd` is a snapshot, like `bookings.unit_price_vnd`: re-pricing the
 * day afterwards must not move a bill someone already has. Switching to the
 * day's other suất is not a re-pricing — that writes a new snapshot.
 */
export const dayOrders = pgTable(
  "day_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    menuDayId: uuid("menu_day_id")
      .notNull()
      .references(() => menuDays.id, { onDelete: "cascade" }),
    setPriceVnd: integer("set_price_vnd").notNull(),
    // Which of the day's suất this is. Stored so that moving between tiers
    // re-prices the row while a price edit alone still never does.
    setTier: setTier("set_tier").notNull().default("full"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("day_orders_user_day_unique").on(t.userId, t.menuDayId),
    index("day_orders_day_idx").on(t.menuDayId),
  ],
);

/* ───────────────────────────────── bookings ──────────────────────────────── */

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    menuDayId: uuid("menu_day_id")
      .notNull()
      .references(() => menuDays.id, { onDelete: "cascade" }),
    menuItemId: uuid("menu_item_id")
      .notNull()
      .references(() => menuItems.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    // Price snapshot. Editing a menu price later must not change an existing bill.
    unitPriceVnd: integer("unit_price_vnd").notNull(),
    note: text("note"),
    status: bookingStatus("status").notNull().default("booked"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One row per user per dish; ordering two portions bumps `quantity`.
    unique("bookings_user_item_unique").on(t.userId, t.menuItemId),
    index("bookings_user_day_idx").on(t.userId, t.menuDayId),
    index("bookings_day_idx").on(t.menuDayId),
  ],
);

/* ───────────────────────────────── payments ──────────────────────────────── */

/**
 * A row exists only once a user has claimed payment for that date. "Unpaid" is
 * therefore the absence of a row — no nightly job has to materialise one row per
 * user per day.
 *
 * `claimId` groups the dates settled by a single bank transfer so the admin can
 * confirm the whole transfer in one click.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceDate: date("service_date").notNull(),
    amountVnd: integer("amount_vnd").notNull(),
    status: paymentStatus("status").notNull().default("pending"),
    claimId: uuid("claim_id").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    note: text("note"),
  },
  (t) => [
    unique("payments_user_date_unique").on(t.userId, t.serviceDate),
    index("payments_claim_idx").on(t.claimId),
    index("payments_date_status_idx").on(t.serviceDate, t.status),
  ],
);

/* ─────────────────────────────── app settings ────────────────────────────── */

/** Single-row table; always read and written with id = "default". */
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("default"),
  bankCode: text("bank_code").notNull().default(""),
  bankAccountNo: text("bank_account_no").notNull().default(""),
  bankAccountName: text("bank_account_name").notNull().default(""),
  qrTemplate: text("qr_template").notNull().default("compact2"),
  /** Pre-fills the ship fee on every new menu day. */
  defaultShipFeeVnd: integer("default_ship_fee_vnd").notNull().default(0),
  /**
   * An optional bank QR photo the admin uploads — the one their banking app
   * produces. Held as base64 because a QR PNG is a few tens of KB: it travels
   * with the existing database backups and needs no storage service.
   *
   * Unlike the generated VietQR it is static, so it cannot carry the amount or
   * the memo. It is used only when VietQR cannot be built.
   */
  qrImageData: text("qr_image_data"),
  qrImageType: text("qr_image_type"),
  /**
   * The seasonal backdrop behind the diner pages — an id from `HOME_THEMES`
   * (`src/lib/home-themes.ts`), or "none". Text rather than a pg enum so a new
   * theme is a code change, not a migration; an id the code no longer knows
   * renders as "none".
   */
  homeTheme: text("home_theme").notNull().default("none"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ──────────────────────────────── relations ──────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  payments: many(payments),
  dayOrders: many(dayOrders),
}));

export const menuDaysRelations = relations(menuDays, ({ many }) => ({
  items: many(menuItems),
  bookings: many(bookings),
  dayOrders: many(dayOrders),
}));

export const menuItemsRelations = relations(menuItems, ({ one, many }) => ({
  menuDay: one(menuDays, {
    fields: [menuItems.menuDayId],
    references: [menuDays.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  menuDay: one(menuDays, { fields: [bookings.menuDayId], references: [menuDays.id] }),
  menuItem: one(menuItems, { fields: [bookings.menuItemId], references: [menuItems.id] }),
}));

export const dayOrdersRelations = relations(dayOrders, ({ one }) => ({
  user: one(users, { fields: [dayOrders.userId], references: [users.id] }),
  menuDay: one(menuDays, { fields: [dayOrders.menuDayId], references: [menuDays.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
}));

/* ────────────────────────────────── types ────────────────────────────────── */

export type User = typeof users.$inferSelect;
export type MenuDay = typeof menuDays.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type DayOrder = typeof dayOrders.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type SetTierKey = (typeof setTier.enumValues)[number];
