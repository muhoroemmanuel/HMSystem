# MedCore HMS

A clinic system in two halves that share one database:

1. **Public website** (`/`) — what the clinic offers, the clinicians, opening hours, and a
   four-step appointment booking flow that anyone can use without an account.
2. **Staff application** (`/app`) — patients, appointments, clinicians, billing, pharmacy and
   settings, with role-based access control and an audit trail.

Everything on screen is real data from PostgreSQL. There is **no demo/seed data** in the
application — on a fresh install every list is genuinely empty until your team adds records.

---

## Quick start (5 minutes)

Requirements: Node 20+ and, for production, PostgreSQL 13+.

```bash
npm install                 # installs both workspaces

cp backend/.env.example backend/.env
# edit backend/.env: set JWT_SECRET and ADMIN_EMAIL (see "Configuration")

npm run setup               # creates all 18 tables, roles, admin + service catalogue
npm run dev                 # API on :4000, website on :5173
```

Open <http://localhost:5173> for the website and <http://localhost:5173/staff> to sign in.

> **No PostgreSQL installed?** Set `DEV_DB=true` in `backend/.env`. The API then boots an
> embedded PostgreSQL (PGlite — real Postgres compiled to WebAssembly) in `backend/.data/`,
> so you can run the whole system locally with no database server at all. Never use this in
> production.

### Optional: sample data for a walkthrough

A fresh install is deliberately empty — there is no demo data in the application. If you want
to click around with realistic content on your own machine:

```bash
cd backend
npm run db:demo            # 3 clinicians, 6 patients, appointments, invoices, stock, sales
npm run db:demo -- --reset # remove every sample record again
```

It refuses to run when `NODE_ENV=production` or when the database already contains real
patients, and every record it creates is tagged so it can be removed in one command.
Extra logins it creates (password `DemoStaff2026`): `reception@demo.clinic`,
`billing@demo.clinic`, `pharmacy@demo.clinic`.

### Configuration (`backend/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (Supabase/Neon/RDS/self-hosted) |
| `DEV_DB` | `true` = use the embedded development database instead |
| `JWT_SECRET` | **Required.** 32+ random chars. Rotating it signs everyone out |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The first administrator created by `npm run setup` |
| `ADMIN_NAME`, `CLINIC_NAME`, `CLINIC_LOCATION` | Seeded clinic identity (editable in the app) |
| `CORS_ORIGIN` | Comma-separated allowed browser origins |
| `TRUST_PROXY` | Number of proxies in front of the API (1 on Render/Railway/Nginx) |
| `LOGIN_RATE_LIMIT`, `BOOKING_RATE_LIMIT` | Requests allowed per window, per IP |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## "We use Prisma — how do I actually look at the data?"

**Short answer: there are tables, and you can see them.** Your earlier schema was Prisma, but
Prisma is only a *client library* — it creates ordinary PostgreSQL tables. The reason you
couldn't find them is that nothing had ever been created: `@prisma/client` wasn't installed,
there were no migrations, and no `DATABASE_URL`.

This project keeps the same idea (Postgres tables, typed access, migrations) but applies the
schema with plain SQL in [`backend/db/schema.sql`](backend/db/schema.sql). That single file
works identically on Supabase, Neon, RDS or a local install — there is no vendor-specific magic.

### Inspecting the data

| Where | How |
| --- | --- |
| **Supabase** | Table Editor → you'll see `patients`, `appointments`, `invoices`, `drugs`, … (18 tables). The SQL Editor gives you the same power as `psql`. |
| **Prisma Studio** | `npx prisma studio` with `provider = "postgresql"` works against these tables — Studio only needs a connection string. |
| **`psql` / any SQL client** | `psql "$DATABASE_URL"` then `\dt`, `SELECT * FROM patients LIMIT 20;` |
| **DBeaver / TablePlus / pgAdmin** | Point them at `DATABASE_URL`. |
| **In the app** | Staff → **Staff & roles → Audit log** shows every create/update/payment with who did it and from which IP. |

### "Should I just use Supabase for everything?"

**Yes — as the database, not as the backend.** Use Supabase for Postgres (plus its dashboard,
backups and SQL editor). Keep this Express API in front of it, because:

- A browser-side Supabase client embeds your API key in JavaScript. For an HMS that means
  anyone who opens DevTools could read patient records unless every table has correct RLS.
- Business rules — "no double booking", "can't oversell stock", "can't overpay an invoice" —
  belong server-side where they can't be bypassed.
- Payments, audit logging and role checks need a trusted layer.

`backend/db/rls.sql` is included and **is worth running**: it lets anonymous visitors read only
the public catalogue (services, doctors, opening hours) and blocks everything clinical. Your
API connects as the owner role, so it is unaffected. That way, even if the anon key leaks,
patient data stays private.

If you later want the Supabase JS client for a small feature (e.g. a patient portal reading
their own appointments), RLS already supports it via `request.jwt.claims`.

---

## Architecture

```
backend/
  db/schema.sql          # the database (18 tables, constraints, indexes, triggers)
  db/rls.sql             # optional Supabase row-level security
  src/db/index.ts        # connection pool + embedded dev database
  src/middleware/auth.ts # JWT access tokens, rotating refresh tokens, permissions
  src/routes/            # public, auth, patients, appointments, doctors,
                         # billing, pharmacy, settings, users, dashboard
  src/cli/migrate.ts     # npm run db:migrate
  src/cli/seed.ts        # npm run db:seed   (no demo records)
frontend/
  src/pages/             # Landing, Book, Lookup, Login, Dashboard, Patients,
                         # Appointments, Doctors, Billing, Pharmacy, Services,
                         # Users, Settings
  src/lib/api.ts         # fetch wrapper with silent token refresh
  src/test/              # interaction tests that run against a live API
```

**Security model**

- Short-lived JWT access tokens (20 min) + rotating refresh tokens in `httpOnly` cookies.
  Re-use of a rotated token revokes every session for that user.
- Permissions are stored per role in the `roles` table and checked on every write.
- Passwords are bcrypt (cost 12). Login responses are deliberately vague ("Invalid email or
  password") and timing-safe.
- `helmet`, CORS allow-list, and per-IP rate limits on login, booking and writes.
- `audit_log` records who changed what, when, and from where.

---

## Day-to-day use

1. **Settings → Clinic settings** — name, tagline, about text, address, phone numbers, opening
   hours, VAT rate, slot length and timezone. These feed the public website immediately.
2. **Clinicians** — add each doctor *and their weekly availability*. Availability generates the
   bookable slots; a clinician with no availability cannot be booked (by staff or patients).
3. **Services** — the catalogue shown on the website and offered when booking. Publish/hide per
   service without deleting history.
4. **Patients** — register at the desk, or they are created automatically when someone books
   online. Patient numbers are `MC-YYYY-NNNNN`.
5. **Appointments** — schedule, confirm, complete or cancel with a reason. The scheduler
   rejects double bookings and appointments outside the clinician's hours.
6. **Billing** — raise an invoice from the service catalogue, take part-payments, and take
   M-Pesa/card/cash/insurance references. Overpayment is rejected.
7. **Pharmacy** — maintain stock, sell at the till (stock decrements atomically), record
   prescriptions and dispense them.
8. **Staff & roles** — create accounts, change roles, suspend access, and review the audit log.

---

## Production deployment

1. **Database** — create a Postgres instance (Supabase, Neon, RDS…). Copy the connection string
   into `DATABASE_URL`. Use the pooler URL on Supabase if you run the API serverlessly.
2. **Migrate & seed once** (against production):
   ```bash
   cd backend
   npm run db:migrate
   npm run db:seed          # creates the admin + the starter service catalogue
   psql "$DATABASE_URL" -f db/rls.sql   # if you are on Supabase
   ```
3. **API** — `npm run build` then `npm start` (or point Render/Railway at `backend/`).
   Set `NODE_ENV=production`, `JWT_SECRET`, `CORS_ORIGIN=https://your-domain`, `TRUST_PROXY=1`.
4. **Website** — `npm --workspace hms-frontend run build` and serve `frontend/dist`. If it is on
   a different domain from the API, set `VITE_API_URL=https://api.your-domain/api` at build time.
   For single-page routing, rewrite unknown paths to `index.html`.
5. **Harden** — HTTPS only, set `secure` cookies (automatic in production), back up nightly,
   and rotate `JWT_SECRET` if a device is lost.

### Tests

```bash
npm run test:e2e    # self-contained: builds a throwaway database, boots the API, runs all 24 tests
```

`test:e2e` is what CI runs and it is the recommended way to verify a checkout. It creates its
own empty database in `backend/.data` on port 5433, seeds it, starts the API on port 4001, runs
the suite, then deletes the database — so it never touches your development data and you do not
need anything else running.

The 24 tests cover the landing page, the full booking journey, booking lookups, sign-in
failure/success, every staff screen, and session handling (concurrent refreshes and sign-out). They exercise the real UI against the real API, not
mocks, which is why the database has to exist.

If you would rather run them against a server you already have:

```bash
cd frontend
TEST_API_ORIGIN=http://127.0.0.1:4000 \
TEST_ADMIN_PASSWORD=<your admin password> \
npx vitest run
```

Two things to know when pointing the suite at your own database:

- The administrator password must match (`TEST_ADMIN_PASSWORD`; it cannot be guessed).
- Raise `LOGIN_RATE_LIMIT` and `BOOKING_RATE_LIMIT` in `backend/.env`. The suite performs dozens
  of sign-ins and bookings in seconds, and the production limits will trip — the failures look
  like application bugs but are just rate limiting. `backend/.env.test` has suitable values.

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

| Job | What it does |
| --- | --- |
| `verify` | `npm ci`, `npm run typecheck`, `npm run build` |
| `e2e` | `npm run test:e2e` — the full 24-test suite against a real database |

Nothing needs configuring in GitHub — no secrets, no external database. The embedded Postgres
means CI is self-contained.

---

## What changed from the original scaffold

- Removed the in-memory demo arrays from every route and the 1,594-line prototype component.
- Replaced in-memory auth (hardcoded users, SHA-256) with bcrypt, JWT and refresh tokens.
- Replaced the Prisma schema (no client installed, never migrated) with an applied SQL schema.
- Added the public website, booking flow and booking lookup.
- Wired every screen and button to the API; added billing, pharmacy, services and staff screens
  that previously did not exist.
- Added production concerns: validation, rate limiting, audit logging, error handling and tests.
