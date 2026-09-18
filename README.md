# 🍽️ Lunch Time

A small internal web app for running team lunch: you post a menu each day, people
book what they want, they pay you by bank transfer, and you can see at a glance
who has actually settled up.

Built with Next.js 15 (App Router), Drizzle + Postgres, and Clerk for auth.

---

## What it does

**For everyone**
- Sign in with an email address (Clerk) — no password, just a code Clerk emails you.
- See today's menu and book dishes, up to a cutoff time you set.
- Book tomorrow in advance, and browse any day.
- See what you owe, scan a **VietQR** code with the amount and memo pre-filled,
  then tap *I transferred*.

**For the admin**
- Build the menu per day: add dishes and prices, copy yesterday's menu, set a
  cutoff, open/lock the day.
- Kitchen list: headcount per dish plus a per-person breakdown, with a Copy button
  for pasting straight into a chat with the restaurant.
- **Payment roster**: a grid of everyone × every day in a date range, showing
  paid / claimed / unpaid, with running totals. Confirm or reject a claim, or mark
  someone paid directly if they handed you cash.

---

## Setup

### The quick way

If you just want it running, `npx clerk@latest init --accountless` creates a Clerk
application with development keys and writes them to `.env.local` — no Clerk
account, no browser. Claim it later with `clerk auth login`.


```bash
pnpm install
pnpm db:local     # starts a local Postgres in .localdb/ and prints its URL
pnpm db:migrate   # create the tables
pnpm setup        # interactive wizard: Clerk keys, admin, bank details
pnpm dev          # http://localhost:3000
```

`pnpm setup` opens each dashboard page for you, tells you exactly what to click,
and writes everything into `.env.local`. Re-run it any time — it keeps values you
already saved. The manual equivalent of each step is below.

### The manual way

You need three things: a database, a Clerk application, and your bank details.

### 1. Install

```bash
pnpm install
cp .env.local.example .env.local
```

### 2. Database

Either run `pnpm db:local` for a self-contained Postgres under `.localdb/`
(no signup, no password — `pnpm db:local:destroy` removes it), or create a
project at [console.neon.tech](https://console.neon.tech) and copy the **pooled**
connection string into `DATABASE_URL`. Then:

```bash
pnpm db:generate   # only needed after you change src/db/schema.ts
pnpm db:migrate    # apply migrations
```

> Any Postgres works. The client in `src/db/index.ts` picks the Neon HTTP driver
> for `*.neon.tech` URLs and node-postgres for anything else, so a local
> `postgresql://localhost:5432/lunch` is fine for development.

### 3. Auth (Clerk)

1. Create an application at [dashboard.clerk.com](https://dashboard.clerk.com/apps/new).
2. Under **Configure → Email, phone, username**, enable **Email address**.
   For truly passwordless sign-in (type your address, paste the emailed code),
   also turn **Password** off. Under **Configure → SSO connections**, turn off any
   social providers you don't want — a new Clerk app ships with Google on.
3. Copy the keys from **Configure → API keys** into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   and `CLERK_SECRET_KEY`.

The `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `SIGN_UP_URL` values in
`.env.local.example` match the routes in `src/app/login` and `src/app/sign-up`;
leave them alone unless you move those.

### 4. Admin access and bank details

```
ADMIN_EMAILS="you@yourcompany.com"      # comma-separated; these accounts see /admin
DEFAULT_BANK_CODE="VCB"                 # seeds the settings row on first run
DEFAULT_BANK_ACCOUNT_NO="0123456789"
DEFAULT_BANK_ACCOUNT_NAME="NGUYEN VAN A"
```

Bank codes come from [api.vietqr.io/v2/banks](https://api.vietqr.io/v2/banks). You
can change all of this later at `/admin/settings` — the env vars only seed the
first run.

### 5. Run

```bash
pnpm dev          # http://localhost:3000
```

Sign up with an email listed in `ADMIN_EMAILS`, go to **Menu**, add today's dishes, set the
status to **open**, and you're live.

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm setup` | Interactive wizard for Clerk keys, admin and bank details |
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build and serve |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Generate a migration from `src/db/schema.ts` |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:local` | Start a local Postgres in `.localdb/` (also `:stop`, `:destroy`) |
| `pnpm db:studio` | Drizzle Studio — browse the data |
| `pnpm db:verify` | Run the data-layer checks against `DATABASE_URL` (**destructive — it truncates every table, point it at a scratch database only**) |

---

## How it's put together

```
src/
  app/
    login/ sign-up/         Clerk's widgets, on catch-all routes
    (app)/                  everything behind auth (AppShell + requireUser)
      page.tsx              today's menu
      menu/[date]/          any day
      me/bookings|payments/ your history and settling up
      admin/                menu, kitchen list, payment roster, settings
  db/
    schema.ts               the whole data model
    queries/                reusable reads shared by pages and actions
  lib/
    auth/session.ts         getCurrentUser / requireUser / requireAdmin
    vietqr.ts date.ts money.ts
```

### Decisions worth knowing

**Auth is verified on the server, always.** Clerk owns identity; `clerkMiddleware`
gates routing, but every protected page *and* every Server Action calls
`requireUser()` / `requireAdmin()` — the layout check alone is not the boundary.
Admin is `ADMIN_EMAILS.includes(email)`, evaluated server-side only.

**The local `users` row is created lazily.** The rest of the schema joins on our
own `users.id`, so every Clerk account needs a row. `getCurrentUser()` reads it by
`clerk_user_id` and, only when it's missing, fetches the profile from Clerk and
inserts. No webhook, so nothing needs a public URL to work locally.

**Prices are snapshotted at booking time.** `bookings.unit_price_vnd` is copied
from the menu item. Editing a price later never changes a bill someone already has.

**"Unpaid" is the absence of a row.** A `payments` row is created only when someone
claims payment, so nothing has to materialise a row per person per day. Days
settled by one bank transfer share a `claim_id`, which is what lets the admin
confirm a whole transfer in one click.

**Amounts are never trusted from the client.** Every claim and every admin
"mark paid" recomputes the total from the booking rows server-side.

**Money is integer VND.** No floats anywhere. Times are anchored to
`Asia/Ho_Chi_Minh` via `src/lib/date.ts`, never a bare `new Date()`.

---

## Deploying

Vercel is the path of least resistance: import the repo, paste the same env vars,
deploy. Then:

- Create a **production instance** in Clerk and use its `pk_live_` / `sk_live_`
  keys — the `pk_test_` keys only work on development domains.
- Set `NEXT_PUBLIC_APP_URL` to the real URL.
- Run `pnpm db:migrate` against the production `DATABASE_URL`.

---

## Not built (yet)

Recurring/standing orders · reminders before the cutoff · multiple restaurants ·
dish photos · automatic bank reconciliation (confirmation stays manual) · a
voting poll for tomorrow's menu · Vietnamese UI translation · welcome emails.
