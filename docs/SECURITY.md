# ShowSkills Rewards — security overview

No website can be guaranteed “unhackable.” This project uses **defense in depth**: payment providers hold card data; our server validates amounts and bundles; rate limits slow abuse.

## What is already enforced in code

### Payments (PayPal)

- Order **amount** set server-side when creating the order.
- **`capture-paypal-order`**: rate-limited; verifies capture **amount** and **bundle** match the catalog before saving tickets.

### Payments (Cashflows Embedded Checkout)

- Uses Cashflows **Embedded Fields** (card iframes on-site, not hosted redirect). Card data stays in Cashflows-hosted iframes.
- **`create-cashflows-payment-intent`**: rate-limited; creates a payment intent with server-side **bundle amount**; stores a pending ticket keyed by `paymentJobReference`.
- **`record-cashflows-payment`**: rate-limited; re-fetches intent status from Cashflows before marking tickets paid (does not trust the browser alone).
- **`/api/cashflows-webhook`**: optional backup when Cashflows sends `PaymentStatusChange` (whitelist their IPs in production).
- Set `VITE_CASHFLOWS_ENABLED=1` plus `CASHFLOWS_CONFIGURATION_ID`, `CASHFLOWS_API_KEY`, and `CASHFLOWS_INTEGRATION=1` for test.

### Admin

- JWT session cookie (`ADMIN_JWT_SECRET`, min 32 chars).
- Prefer **`ADMIN_PASSWORD_HASH`** (bcrypt) over plain `ADMIN_PASSWORD` in production.
- **Login rate limit** (slows brute force).
- **Email 2FA** (optional, free via Resend): when `RESEND_API_KEY` + `ADMIN_EMAIL` are set, login is password → 6-digit email code → session. See `.env.example`.

### Public accounts

- **One password-backed account per canonical email** (Gmail dot/plus aliases normalised).
- **Checkout-only emails** cannot be hijacked via register — use **Forgot password** email verification to claim the account.
- **Registration rate limits** per IP; disposable email domains blocked.
- **Paid skill quiz** cannot be submitted twice for the same order.

### General API

- Bundle **prices and ticket counts** come only from `shared/ticketBundles.mjs` (never from the browser).
- Parameterized SQL (no string-built queries).
- Input length limits on names, emails, and notes.
- **E2E mock payment routes** only registered when `E2E_MODE=1` (do not enable in production).

## Environment variables (production checklist)

| Variable | Purpose |
|----------|---------|
| `PAYPAL_CLIENT_SECRET` | Server only |
| `CASHFLOWS_API_KEY` | Server only — never `VITE_` |
| `CASHFLOWS_CONFIGURATION_ID` | Server only |
| `VITE_CASHFLOWS_ENABLED` | Turn on embedded Cashflows UI |
| `ADMIN_JWT_SECRET` | Long random string (32+ chars) |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password |
| `SITE_URL` / `ALLOWED_ORIGINS` | Restrict CORS to your real domain(s) |
| `E2E_MODE` | **Unset** in production |

## PayPal Dashboard

1. Use **Live** vs **Sandbox** credentials consistently with `PAYPAL_MODE`.
2. Review **disputes** and capture logs in the developer dashboard.

## Cashflows

1. Use integration credentials with `CASHFLOWS_INTEGRATION=1` until go-live.
2. Configure webhook URL `https://your-domain/api/cashflows-webhook` and whitelist Cashflows IPs.

## Hosting (Vercel / VPS)

1. **HTTPS only** for production.
2. Do not commit `.env.local` or secrets to git.
3. Rotate keys if leaked.
4. Keep dependencies updated (`npm audit`).
5. Enable **Vercel Firewall** — see [VERCEL_FIREWALL.md](./VERCEL_FIREWALL.md).
6. For scale, replace in-memory rate limits with **Redis** or edge rate limiting.

## Archived Stripe integration

Previous Stripe Checkout / Payment Element code lives in `archive/stripe/` for reference and seed scripts only. It is **not** mounted in production routes.

## Optional hardening (not all implemented)

- **CAPTCHA** — Self-hosted **ALTCHA** proof-of-work on World Cup Ball quiz **start** (uses `ADMIN_JWT_SECRET` automatically; optional `ALTCHA_HMAC_KEY`).
- **Redis** rate limiting for multi-instance deploys.
- **WAF** rules for admin paths and webhook endpoints.
