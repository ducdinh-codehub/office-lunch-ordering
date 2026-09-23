# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # dev server (Turbopack) on :3000
pnpm build            # production build — also the real typecheck gate
pnpm lint             # eslint
npx tsc --noEmit      # typecheck alone, faster than a full build

pnpm setup            # interactive credential wizard (scripts/setup.sh)
pnpm db:local         # self-contained Postgres in .localdb/ (also :stop, :destroy)
pnpm db:generate      # generate a migration after editing src/db/schema.ts
pnpm db:migrate       # apply pending migrations to .env.local's database
pnpm db:migrate:prod  # ...and to the production one named in .env.prod
pnpm db:studio        # browse data
pnpm db:verify        # data-layer checks (see below)
```

There is no unit test framework. `pnpm db:verify` (`scripts/verify-db.mts`) is the
only automated check: it seeds a database and asserts ~30 invariants across the
query layer. **It truncates every table first** — point `DATABASE_URL` at a scratch
database, never a real one. It runs under `tsx --conditions=react-server` because
the modules it imports are marked `server-only`; that flag is required, not
incidental.

## Required environment

Dev and production use **separate databases**. `.env.local` points at the local
Postgres `pnpm db:local` starts; `.env.prod` holds the hosted URL Vercel serves and
is read only by `pnpm db:migrate:prod`. Vercel's build does not migrate, so a new
migration must be applied to both before deploying — otherwise the deployed code
selects columns the production database does not have yet.

Nothing runs without `.env.local`. `pnpm setup` walks a human through producing
it; `.env.local.example` documents every key. `src/env.ts` throws a named error on
first access to a missing var rather than yielding `undefined` mid-request. Clerk
reads its own keys straight from `process.env`, so they are not in `serverEnv`.

## Architecture

### Auth: Clerk for identity, our own row for everything else

Clerk owns sign-in. `src/middleware.ts` runs `clerkMiddleware` and calls
`auth.protect()` on everything except `/login` and `/sign-up`, both of which are
catch-all routes because Clerk's widgets own their own sub-paths.

The rest of the schema joins on our own `users.id`, not a Clerk id, so every Clerk
account needs a local row. `getCurrentUser()` (`src/lib/auth/session.ts`) creates it
**lazily**: read by `clerk_user_id`, and only on a miss call `currentUser()` and
insert. The alternative — a Clerk webhook — needs a public URL and a signing secret
before anything works locally, which is not worth it at this size. The trade-off is
that a name or avatar changed in Clerk is not mirrored until the row is recreated.

`users.display_name` is ours, not Clerk's mirror. `/me/profile` lets each person
rename themselves and `/admin/settings` lets an admin rename anyone; both parse
`displayNameField` (`src/lib/display-name.ts`), which is the only definition of
what a name may be — two entry points writing one column must not disagree. Every
list in the app reads that column, falling back to the email's local part.
Nothing reads the Clerk name again once the row exists, so the two are expected
to differ.

**`requireUser()` / `requireAdmin()` must be called at the top of every Server
Action, not only in layouts.** Middleware and layout checks are routing
conveniences; actions are separately addressable endpoints. Admin status is
`ADMIN_EMAILS.includes(email)` evaluated server-side — there is no role column and
no client-visible admin flag.

### Database

`src/db/index.ts` picks the driver from the connection string: Neon's HTTP driver
for `*.neon.tech`, node-postgres for anything else. Both are typed as one
`Database`, so nothing downstream branches on it. Consequence of the Neon HTTP
driver: **no interactive transactions** — use `db.batch()` when several writes must
land together.

Reads shared by more than one page live in `src/db/queries/`. Prefer extending
those over writing ad-hoc queries in a page.

### Domain invariants

These are the rules the data model exists to protect. Breaking one is a correctness
bug, not a style issue.

- **Prices are snapshotted.** `bookings.unit_price_vnd` is copied from the menu item
  at booking time. Editing a menu price must never change a bill someone already
  has. `menu_items.price_vnd` is only ever the *current* advertised price.
- **A date may hold two menus, and exactly two.** `menu_days` is keyed on
  `(service_date, slot)`, where `slot` is `lunch` or `afternoon` — the second
  sitting exists for the small parties that happen after work. The enum plus the
  unique constraint *is* the "max 2" rule; there is no count to check. Every
  per-menu read takes a `menu_day_id`, never a date: `getKitchenSummary`,
  `getDayBookingsByPerson`, `getDayOrdersByPerson`, `getUserBookingsForDay`,
  `getUserSetPriceForDay`. Merging the two would send the party to the quán
  inside the lunch order and count its dishes towards the lunch suất. **Money is
  the deliberate exception**: `getUserDailyTotals`, `getUserTotalsForDates`,
  `getShipShares` and the roster all aggregate *per date*, so lunch and the
  party are one amount, one QR and one bank transfer — which is why `payments`
  can stay keyed on `(user_id, service_date)`. The sitting travels in the `buoi`
  query parameter, and its absence means lunch, so every link written before the
  second menu existed still resolves the way it always did. `ServiceDate` is a
  bare `string`, so the compiler will *not* catch a date passed where a
  `menu_day_id` belongs — `pnpm db:verify` is what catches it.
- **Locking lunch hands the day to the party.** `resolveActiveSlot()`
  (`src/lib/menu-slot.ts`) decides which sitting a link *without* `buoi` lands
  on: lunch, until its status is `locked` **and** an afternoon menu is already
  `open` — then the party. A party still in `draft` never takes over, and
  locking lunch never publishes one; the status is a precondition, not an
  effect. An explicit `?buoi=lunch` still reaches the locked lunch menu, which
  is how a diner sees what they ordered and still owe.
- **The party closes after lunch, never with it or before.**
  `cutoffOrderError()` is the rule; `upsertMenuDay` applies it to whichever
  sitting is being saved, so editing lunch to close *later* than the party is
  refused just as an early party deadline is. Equal instants are refused too —
  with both on the same moment there is no telling which order is still open. A
  missing cutoff is not an early one: it means that sitting has no deadline.
- **"Suất chưa đủ món" means a suất was started and left short.** Not "no suất":
  a per-dish menu — an afternoon party included — has none to be incomplete, and
  neither does a date where the only bookings are drinks and gọi thêm.
  `DailyTotal.incompleteSet` is the signal, true only where the diner took a
  món chính / phụ / rau on a menu with no completed `day_orders` row. Deriving
  it from "no set + some items", as the bookings page once did, labels every
  à-la-carte day as a broken order.
- **A day is priced one way or the other, never both.** *Combo mode* sells a suất:
  a fixed price for a required number of món chính / phụ / rau, with "gọi thêm"
  and drinks charged on top. *Per-dish mode* has no suất and no groups — every
  dish carries its own price and any quantity. The mode is **not a column**: a day
  is in combo mode exactly when it asks for at least one dish
  (`offersSet()` in `src/lib/set-tiers.ts`). "Combo mode" is the name in code and
  in conversation; the tab a human reads says **Theo suất**. The admin's mode tabs write the
  required counts; storing a flag beside them would create a second truth that
  could drift. Server-side, `assertCategoryFitsMode` refuses a set-category dish
  on a per-dish day — it would be forced to 0 ₫ *and* never rendered.
- **Combo mode may sell two suất, told apart only by dish count.** `menu_days`
  carries a second, optional set of required counts (`alt_required_*`) and its own
  price — e.g. 1 món chính at 40k beside 2 at 50k. Nobody picks a tier by name:
  whichever tier the picks match exactly is the one they are on
  (`resolveSetTier()` is the single place that decides), so the two tiers must
  never ask for the same dishes. `day_orders.set_tier` records which one, and
  moving between tiers rewrites the price snapshot — that is not a re-pricing, it
  is a different suất. The badges in the day view *choose* a tier: the choice
  lives in the `suat` query parameter and clearing the dishes of the tier being
  left is deliberate, since the two take different numbers of món chính.
- **"Unpaid" is the absence of a `payments` row.** Rows are created only when
  someone claims payment, so nothing materialises a row per person per day. Days
  settled by one bank transfer share a `claim_id`, which is what lets the admin
  confirm a whole transfer at once.
- **Amounts are recomputed server-side on every write.** `claimPayment` and
  `markPaidByAdmin` both call `getUserTotalsForDates()`; a total sent from the
  client is display-only and is never persisted.
- **Money is integer VND.** No floats, no decimals, anywhere. Booking quantity is
  capped at 99 for that reason alone — `quantity × unit_price_vnd` has to stay
  inside a 32-bit integer. It is not a product limit on how much someone may eat.
- **Dates are anchored to `Asia/Ho_Chi_Minh`.** Never `new Date()` for "today" — use
  `todayServiceDate()` from `src/lib/date.ts`. `ServiceDate` is a `YYYY-MM-DD`
  string matching the Postgres `date` columns. `localInputToInstant()` converts a
  `datetime-local` form value (which is Vietnam-local) into a real instant; without
  it a cutoff is read in the server's timezone and lands hours off.

### Server Actions

Actions live in `actions.ts` next to the page that uses them and follow one shape:
`requireUser()` → Zod parse → business-rule check → write → `revalidatePath()`.

They return `ActionResult` (`src/lib/action-result.ts`) rather than throwing, so the
client renders an inline error instead of hitting an error boundary. Throw
`fail("message")` for an expected user-facing failure; `toActionError` passes those
through verbatim and logs anything else behind a generic message.

### UI

`src/app/(app)/` is a route group: its layout calls `requireUser()` and wraps
everything in `AppShell`. `admin/layout.tsx` nests inside it and adds
`requireAdmin()`.

**The shadcn registry here is built on Base UI, not Radix.** Polymorphism uses the
`render` prop, not `asChild`, and a Button rendering a non-`<button>` needs
`nativeButton={false}` or it logs an accessibility error. Use
`src/components/ui/link-button.tsx` for button-styled links rather than
re-deriving that.

`SlotTabs` switches between a date's two sittings. Diners only see it once an
afternoon menu is published; the admin always sees both, because tapping the
absent one is how a party menu gets created. `MenuDayView` renders one sitting
at a time — two on a page would share the single `suat` parameter, so choosing
a suất on one would move the other, which is why the home page links to the
afternoon menu rather than stacking a second card.

`MenuEditor` carries the combo / per-dish tabs. Per-dish mode hides every suất
field, drops the category picker entirely (one bucket, `addon`, relabelled "Món
ăn"), and warns about dishes stranded in a combo category — those would be free
*and* invisible. `MenuDayView` mirrors it: no suất means no sections, just a flat
list of priced rows.

Three boundary gotchas that have already caused bugs:

- `Map` does not survive the server → client boundary. `admin/payments/page.tsx`
  flattens roster cells to a plain `Record` before passing them down.
- A client component holding form state in `useState` will keep it across a
  client-side navigation. `MenuEditor` is given ``key={`${serviceDate}:${slot}`}``
  to force a remount; without it, switching days — or switching between the
  lunch and afternoon tabs of one day — carries the previous menu's cutoff into
  the form and saving writes the wrong value.
- **`useState(prop)` seeds, it does not sync.** `SetDishRow` and `MenuItemRow` hold
  an optimistic tick/count for instant feedback, and both re-seed from the server
  value whenever it moves (the render-phase adjust pattern, not an effect).
  Without that, a pick cleared server-side — switching suất, an admin ordering on
  your behalf — stays on screen as a tick standing for a booking that no longer
  exists.

Fonts: the Geist CSS variables are on `<html>`, not `<body>`, because `globals.css`
applies `font-sans` at the root. `<ClerkProvider>` wraps `<html>` in the root
layout.

### Payments UX

The QR is VietQR's quicklink image API (`src/lib/vietqr.ts`) — a plain `<img>`, no
QR library. The base URL is built on the server and the client appends `amount` and
`addInfo` as the day selection changes, so the code always matches what is ticked.
Transfer memos are ASCII-only (`[A-Z0-9 ]`) because Vietnamese banks strip
diacritics and punctuation from the description field.
