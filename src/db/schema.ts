import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ────────────────────────────────── enums ────────────────────────────────── */

export const menuDayStatus = pgEnum("menu_day_status", [
  "draft", // being prepared, invisible to users
  "open", // users can book
  "locked", // cutoff passed, order sent to the kitchen
]);

/**
 * Which sitting a menu belongs to. A date sells lunch by default; `afternoon` is
 * the optional second menu, for the small parties that happen after work. Two
 * values plus the unique constraint below are what caps a date at two menus —
 * there is no count to check and no third slot to create.
 */
export const menuSlot = pgEnum("menu_slot", ["lunch", "afternoon"]);

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

/** The two emails the admin can send. See src/lib/email/. */
export const emailKind = pgEnum("email_kind", [
  "billing", // Nhắc nợ — each person's own unpaid days, computed when it is sent
  "notice", // Thông báo — the same text to everyone, e.g. an event
]);

/** Who an email job goes to. Billing to "everyone" means everyone who owes. */
export const emailAudience = pgEnum("email_audience", ["everyone", "selected"]);

export const emailRepeat = pgEnum("email_repeat", ["none", "daily", "weekly", "monthly"]);

export const emailJobStatus = pgEnum("email_job_status", [
  "scheduled", // waiting for `next_run_at`
  "done", // a one-time job that has run
  "cancelled",
]);

export const emailRunTrigger = pgEnum("email_run_trigger", [
  "now", // the admin's "Gửi ngay"
  "cron", // the timer calling /api/cron/emails
]);

export const emailDeliveryStatus = pgEnum("email_delivery_status", [
  "pending", // claimed, not yet handed to the mail server
  "sent",
  "failed",
]);

/* ────────────────────────────────── users ────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Clerk owns identity; this is the join key back to it.
    clerkUserId: text("clerk_user_id").notNull().unique(),
    email: text("email").notNull().unique(),
    displayName: text("display_name"),
    photoUrl: text("photo_url"),
    // The birthday, as day and month only — the year buys nothing and is
    // nobody's business. Both or neither; the diner sets it once, the admin
    // may change it. See src/lib/birthday.ts.
    birthMonth: smallint("birth_month"),
    birthDay: smallint("birth_day"),
    // Notice emails (events) can be turned off by the person. Billing emails
    // cannot — they are about money the person owes.
    noticeEmailsEnabled: boolean("notice_emails_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "users_birthday_check",
      // `is not null` spelled out: `null between 1 and 31` is null, not false, and
      // a check that yields null passes — a month with no day would slip through.
      sql`(${t.birthMonth} is null and ${t.birthDay} is null) or (${t.birthMonth} is not null and ${t.birthDay} is not null and ${t.birthMonth} between 1 and 12 and ${t.birthDay} between 1 and 31)`,
    ),
  ],
);

/* ──────────────────────────────── menu days ──────────────────────────────── */

export const menuDays = pgTable(
  "menu_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The calendar day, interpreted in Asia/Ho_Chi_Minh. Not unique on its own —
    // `slot` is the other half of the key.
    serviceDate: date("service_date").notNull(),
    // Lunch, or the optional afternoon party menu. A date is resolved by both.
    slot: menuSlot("slot").notNull().default("lunch"),
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
  },
  (t) => [
    // One menu per sitting per day. With only two slots in the enum this is
    // also the ceiling: a date can hold a lunch and an afternoon menu, no more.
    unique("menu_days_date_slot_unique").on(t.serviceDate, t.slot),
    index("menu_days_date_idx").on(t.serviceDate),
  ],
);

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
  /**
   * The admin's wish shown in a banner on the home page — "" means no banner.
   * Dismissal is per browser and keyed on the text itself, so editing the
   * wish brings the banner back for everyone who closed the old one.
   */
  greetingMessage: text("greeting_message").notNull().default(""),
  /**
   * Whether the lì xì may mắn is offered. Turning it off wipes
   * `lucky_envelopes`, so turning it back on gives everyone a fresh envelope.
   */
  luckyEnvelopeEnabled: boolean("lucky_envelope_enabled").notNull().default(false),
  /** Whether the Gym Time promo dialog greets each diner once per sign-in. */
  gymPromoEnabled: boolean("gym_promo_enabled").notNull().default(false),
  /**
   * Whether the Gym Time banner sits at the top of the home page. On by
   * default because the banner was shown unconditionally before this existed.
   */
  gymBannerEnabled: boolean("gym_banner_enabled").notNull().default(true),
  /**
   * The pictures framing every email, uploaded at /admin/settings and stored
   * as `email_images` rows. They are each deployment's own branding, so the
   * repository ships none: null means that email has no banner there.
   * The billing header falls back to the general one when it is not set.
   */
  headerBannerImageId: uuid("header_banner_image_id").references(() => emailImages.id, {
    onDelete: "set null",
  }),
  billingBannerImageId: uuid("billing_banner_image_id").references(() => emailImages.id, {
    onDelete: "set null",
  }),
  footerBannerImageId: uuid("footer_banner_image_id").references(() => emailImages.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ───────────────────────────── lucky envelopes ───────────────────────────── */

/**
 * Lì xì may mắn: who has opened their envelope, and what it gave them.
 *
 * One row per person — the unique `user_id` is the "only once" rule, so two
 * taps racing each other still open one envelope. The % comes off that
 * person's whole bill for `service_date`, the day they opened it
 * (`src/lib/lucky-envelope.ts` has the rule every total applies). Rows are
 * deleted wholesale when the admin turns the feature off or resets it; that
 * takes the discount back from any day not yet paid, while a claimed day keeps
 * the amount written on its `payments` row.
 */
export const luckyEnvelopes = pgTable(
  "lucky_envelopes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceDate: date("service_date").notNull(),
    percent: integer("percent").notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lucky_envelopes_date_idx").on(t.serviceDate),
    check("lucky_envelopes_percent_check", sql`${t.percent} in (5, 10, 20)`),
  ],
);

/**
 * A discount the admin gives one person on one date — a thank-you, a
 * correction, whatever the note says. It stacks with the lì xì and the
 * birthday and comes off the finished day total like they do; see
 * `src/lib/day-discount.ts`. The unique `(user_id, service_date)` is what
 * makes setting it again replace rather than add. A day already claimed is
 * refused, because its amount is fixed on the `payments` row.
 */
export const adminDiscounts = pgTable(
  "admin_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    serviceDate: date("service_date").notNull(),
    percent: integer("percent").notNull(),
    // Shown to the diner beside the discount, e.g. "Thưởng tháng 9".
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("admin_discounts_user_date_unique").on(t.userId, t.serviceDate),
    index("admin_discounts_date_idx").on(t.serviceDate),
    check("admin_discounts_percent_check", sql`${t.percent} between 1 and 100`),
  ],
);

/* ─────────────────────────────────── email ───────────────────────────────── */

/**
 * One email the admin sent or scheduled. "Send now" is a job too — it runs
 * the moment it is created — so history has a single shape.
 *
 * A repeating job keeps its row and moves `next_run_at` forward after each
 * run; `first_run_at` is the anchor every occurrence is counted from, so a
 * monthly job set for the 31st lands on the last day of short months without
 * drifting to the 28th for ever after.
 */
export const emailJobs = pgTable(
  "email_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: emailKind("kind").notNull(),
    // Notice: the subject line. Billing: unused — its subject carries each
    // person's own amount.
    subject: text("subject").notNull().default(""),
    // Notice: the message. Billing: an optional note under the amount. HTML
    // from the editor, sanitised before it is stored (src/lib/email/content.ts).
    body: text("body").notNull().default(""),
    audience: emailAudience("audience").notNull(),
    // Only read when `audience` is `selected`.
    recipientUserIds: uuid("recipient_user_ids").array().notNull().default(sql`'{}'`),
    repeat: emailRepeat("repeat").notNull().default("none"),
    // Whether the uploaded banners frame this email, top and bottom.
    showHeader: boolean("show_header").notNull().default(true),
    showFooter: boolean("show_footer").notNull().default(true),
    status: emailJobStatus("status").notNull().default("scheduled"),
    firstRunAt: timestamp("first_run_at", { withTimezone: true }).notNull(),
    // Null once the job is done or cancelled.
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_jobs_due_idx").on(t.status, t.nextRunAt)],
);

/**
 * One email to one person, for one run of a job. The unique key is what stops
 * a person getting the same run twice — a retried cron call, or two calls
 * racing, insert the same row and the second one sends nothing.
 */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => emailJobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The address it went to, as it was then.
    email: text("email").notNull(),
    // The subject it went out with — for billing, the person's own amount.
    subject: text("subject").notNull().default(""),
    // Which occurrence of the job this belongs to — its scheduled instant.
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    status: emailDeliveryStatus("status").notNull().default("pending"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("email_deliveries_job_user_run_unique").on(t.jobId, t.userId, t.runAt),
    index("email_deliveries_job_run_idx").on(t.jobId, t.runAt),
  ],
);

/**
 * Pictures placed in an email body. Held as base64 like the bank QR: there is
 * no storage service, and a few resized photos are small. An email body links
 * them as `/api/email-images/<id>`; when it is sent each one is attached
 * inline (cid:), so recipients never fetch them from the app.
 */
/**
 * One row per run of a job — the history of what was sent, when, and by
 * whom. Deliveries alone cannot tell it: a billing run where nobody owed sends
 * nothing and leaves no delivery, yet it still happened. Written when the run
 * is claimed, and its counts filled in when it finishes.
 */
export const emailRuns = pgTable(
  "email_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => emailJobs.id, { onDelete: "cascade" }),
    // The occurrence this run is for — matches `email_deliveries.run_at`.
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    trigger: emailRunTrigger("trigger").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    // Null while sending, or if the function was cut off mid-run.
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    // Billing recipients who owed nothing, and anyone already sent this run.
    skipped: integer("skipped").notNull().default(0),
  },
  (t) => [
    unique("email_runs_job_run_unique").on(t.jobId, t.runAt),
    index("email_runs_started_idx").on(t.startedAt),
  ],
);

export const emailImages = pgTable("email_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  data: text("data").notNull(),
  type: text("type").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
export type LuckyEnvelope = typeof luckyEnvelopes.$inferSelect;
export type AdminDiscount = typeof adminDiscounts.$inferSelect;
export type EmailJob = typeof emailJobs.$inferSelect;
export type EmailKind = (typeof emailKind.enumValues)[number];
export type EmailRunTrigger = (typeof emailRunTrigger.enumValues)[number];
export type EmailRepeat = (typeof emailRepeat.enumValues)[number];
export type SetTierKey = (typeof setTier.enumValues)[number];
export type MenuSlot = (typeof menuSlot.enumValues)[number];
