# OPflow for Doctors (doctor website)

The doctor side of the OPflow app, on a desk screen. Only doctors added by the OPflow team can sign in (OPD ID +
password); patients use the OPflow app. Everything the doctor app does, the website does: today's OPD console
(start, call next, done, skip, did not come, break, late, pause bookings, end), bookings at every hospital,
booking actions (ask to pick a new time, cancel with 100% money back), timings, leave, emergency status,
messages, message settings, profile, earnings, reports, password — in English and Telugu.

## How it works

```
Browser ──HTTPS──▶ this site (Next.js, Vercel) ──server to server──▶ OPflow API (Render) ──▶ Postgres (Supabase)
   └── WebSocket /live (short-lived pass from /api/live-token) ──────────────────────▶ OPflow API
```

- The session lives only in **httpOnly, SameSite=strict cookies**. The browser never holds the refresh token;
  pages and actions call the API from this server (`src/lib/api.ts`), and `src/proxy.ts` renews the session
  before it runs out.
- The live line (`src/lib/live.ts`) uses the API's WebSocket; while it is down, the console checks every 10 s.
- This site signs in as `platform: 'web'`: it has **its own sign-in place** (2 phones + 1 website), so it never
  signs out the doctor's phone.
- With `DOCTOR_WEB_KEY`, the API sees each doctor's real browser address (sign-in limits, device list).
- Telugu comes from the app's own dictionary (`scripts/sync-te.mjs` → `src/i18n/te.json`, run before every
  build) plus `src/i18n/te-web.json` for website-only texts. `node scripts/missing-te.mjs` lists anything missing.

## Run locally

```bash
cp .env.example .env.local     # DOCTOR_API_BASE_URL, DOCTOR_WEB_KEY (same as the API's), NEXT_PUBLIC_LIVE_URL
npm install
npm run dev                    # http://localhost:3003
```

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## Browser test (every button, end to end)

Against a local API on `:3100` with a **throwaway** database seeded by `npm run seed:demo` (in `backend/`), with
`DOCTOR_WEB_KEY` set on both sides, and this site built and started on `:3003`:

```bash
node tests/doctor.e2e.js       # 62 checks; screenshots in ./shots
```

It books real (test-gateway) patients, runs a whole OPD from the desk, checks a second tab follows live, and
checks the doctor's phone stays signed in.

Deploying: see [DEPLOY.md](DEPLOY.md).
