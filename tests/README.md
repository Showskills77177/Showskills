# End-to-end tests (Playwright)

This suite exercises public flows, mocked payment recording, kick-up submissions, the admin panel, and basic SQLite integrity checks against an **isolated database** (`db/e2e.sqlite`).

## Prerequisites

- Node 18+
- Chromium: `npm run test:install` (once per machine / CI image)

## Run

```bash
npm run test              # all E2E specs
npm run test:e2e          # same
npm run test:admin        # admin specs only
npm run test:payment      # mocked payment spec only
npm run test:ui           # Playwright UI mode
```

Playwright starts **`npm run dev:e2e`** (Vite on **:5173** with `--strictPort`, API on **:3001**) so it does not fight a normal **`npm run dev:all`** on :5173/:3000. Controlled environment:

- `SQLITE_PATH=db/e2e.sqlite` — wiped and re-schematized in **global setup** before the dev server starts
- `VITE_E2E_SIMULATE_CHECKOUT=1` — shows **Continue (E2E simulated checkout)** and skips real Stripe/PayPal
- `E2E_MODE=1` — enables `POST /api/e2e/mock-stripe-completion` (header `x-e2e-secret`) to insert paid **tickets** + **payments** like a successful Stripe checkout

Optional overrides: copy **`.env.e2e.example`** → **`.env.e2e`** (see example file).

## What each file covers

| Spec | Area |
|------|------|
| `user-flow.spec.js` | Home → Competitions → paid modal → simulated checkout → quiz → qualified message |
| `payment-mocked.spec.js` | Mock API ticket row + UI quiz + `competition_entries` |
| `kickup.spec.js` | HTTPS kick-up + multipart upload API |
| `admin.spec.js` | Login, dashboard, users/entries, submissions; unauth redirect |
| `db-integrity.spec.js` | SQLite invariants on `users` / `kickup_submissions` |
| `edge-cases.spec.js` | Invalid kick-up URL, wrong quiz answers, unknown route |

## Adding tests

1. Add `tests/e2e/your-flow.spec.js`
2. Prefer stable roles/labels; avoid brittle CSS selectors
3. Remember **one shared DB** — tests run with `workers: 1` and `fullyParallel: false`

## CI

Set `CI=true` for stricter Playwright settings (retries). Install browsers in the job: `npm run test:install` then `npm run test`.

## Local tips

- If you already run **`npm run dev:e2e`** yourself with the same env as Playwright, you can set **`PW_REUSE_SERVER=1 npm run test`** to skip starting a second stack (defaults to always starting a fresh `dev:e2e`).
- First time only: **`npm run test:install`** downloads Chromium.
