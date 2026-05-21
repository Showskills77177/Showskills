---
name: showskills-e2e-qa-protocol
description: >-
  Defines the ShowSkills end-to-end QA protocol: Playwright E2E tests for user flows
  (home → competitions → paid entry → quiz), mocked payment + DB ticket/entry checks,
  kick-up video upload or link, admin panel auth and data views, SQLite integrity,
  and edge cases (invalid forms, unauthorized admin, console errors). Use when the
  user says to run the E2E/QA protocol, extend the test suite, or verify critical
  flows before deploy.
---

# ShowSkills E2E & QA protocol

When invoked, align implementation with the project’s **`tests/`** suite and **`playwright.config.mjs`**.

## Commands

- `npm run dev:e2e` — Vite **:5173** (strict) + API **:3001** (avoids clashing with `dev:all` on :3000)
- `npm run test` — all Playwright tests
- `npm run test:e2e` — same (alias)
- `npm run test:admin` — admin panel specs only
- `npm run test:payment` — mocked payment flow spec
- `npm run test:install` — install Chromium for Playwright

## Environment

- Isolated DB: **`SQLITE_PATH=db/e2e.sqlite`** (reset in global setup).
- Simulated checkout: **`VITE_E2E_SIMULATE_CHECKOUT=1`** (no real Stripe).
- Mock ticket API: **`E2E_MODE=1`** + **`E2E_SECRET`** → `POST /api/e2e/mock-stripe-completion`.
- Admin credentials: **`ADMIN_USER`**, **`ADMIN_PASSWORD`**, **`ADMIN_JWT_SECRET`** (≥32 chars).

See **`tests/README.md`** and **`.env.e2e.example`**.

## Protocol scope (must stay covered)

1. **User flow** — homepage, competitions, bundle selection, details, post-checkout quiz, success messaging.
2. **Payment (mocked)** — simulate success; assert DB rows for tickets/payments and/or competition entries as designed.
3. **Kick-up** — file upload and/or HTTPS link; admin can see submission.
4. **Admin** — login, dashboard metrics, users, submissions lists; consistency with public submissions.
5. **DB integrity** — required fields, relationships; no silent 0-row updates where tests expect writes.
6. **Edge cases** — invalid/missing fields, wrong quiz answers, failed upload, unauthenticated admin, navigation; no uncaught page errors in happy paths.

## Adding tests

- Place specs under **`tests/e2e/`**; shared helpers under **`tests/support/`**.
- Prefer **`cache: 'no-store'`** patterns for admin API fetches (already in app `apiFetch`).
- Do not use real card or live payment keys in CI.

## Original Q&A brief (reference)

Full user-facing goal: simulate real users with Playwright (or Cypress), single command locally, dedicated `/tests`, assertions on visibility/submits/redirects/DB, mock payments only, sample video/fixtures, and documentation for running and extending the suite.
