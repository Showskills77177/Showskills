# ShowSkills Rewards — security overview

No website can be guaranteed “unhackable.” This project uses **defense in depth**: Stripe/PayPal hold card data; our server validates amounts and bundles; rate limits slow abuse.

## What is already enforced in code

### Payments (Stripe)

- Bundle **prices and ticket counts** come only from `shared/ticketBundles.mjs` (never from the browser).
- **`create-payment-intent`**: rate-limited; creates PaymentIntents with server-side `amount` and metadata.
- **`record-stripe-payment`**: rate-limited; loads the PaymentIntent from Stripe; checks **status = succeeded**, **amount**, **bundle id**, **quantity**, **currency**, and **email** vs receipt email.
- **`/api/stripe-webhook`**: verifies **Stripe signature** (`STRIPE_WEBHOOK_SECRET`); on `payment_intent.succeeded`, records the sale if the browser never called `record-stripe-payment` (recommended in production).
- Card data stays in **Stripe Elements** (PCI scope reduced).

### Payments (PayPal)

- Order **amount** set server-side when creating the order.
- **`capture-paypal-order`**: rate-limited; verifies capture **amount** and **bundle** match the catalog before saving tickets.

### Admin

- JWT session cookie (`ADMIN_JWT_SECRET`, min 32 chars).
- Prefer **`ADMIN_PASSWORD_HASH`** (bcrypt) over plain `ADMIN_PASSWORD` in production.
- **Login rate limit** (slows brute force).
- **Email 2FA** (optional, free via Resend): when `RESEND_API_KEY` + `ADMIN_EMAIL` are set, login is password → 6-digit email code → session. See `.env.example`.

### General API

- Parameterized SQL (no string-built queries).
- Input length limits on names, emails, and notes.
- **E2E mock payment routes** only registered when `E2E_MODE=1` (do not enable in production).

## Environment variables (production checklist)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Server only — never `VITE_` |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Public — safe in frontend |
| `PAYPAL_CLIENT_SECRET` | Server only |
| `ADMIN_JWT_SECRET` | Long random string (32+ chars) |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password |
| `SITE_URL` / `ALLOWED_ORIGINS` | Restrict CORS to your real domain(s) |
| `E2E_MODE` | **Unset** in production |

## Stripe Dashboard (you configure)

1. **Webhooks** → endpoint `https://your-domain/api/stripe-webhook` → events: `payment_intent.succeeded`.
2. **Radar** / rules for fraud and high-risk cards.
3. **Restricted API keys** if you split read/write (optional).
4. **Payment method domains** for Apple Pay / Google Pay if you enable them later.

## PayPal Dashboard

1. Use **Live** vs **Sandbox** credentials consistently with `PAYPAL_MODE`.
2. Review **disputes** and capture logs in the developer dashboard.

## Hosting (Vercel / VPS)

1. **HTTPS only** for production.
2. Do not commit `.env.local` or secrets to git.
3. Rotate keys if leaked.
4. Keep dependencies updated (`npm audit`).
5. Enable **Vercel Firewall** — see [VERCEL_FIREWALL.md](./VERCEL_FIREWALL.md) (Attack Challenge, WAF rules, allow Stripe webhook path).
6. For scale, replace in-memory rate limits with **Redis** or edge rate limiting.

## Optional hardening (not all implemented)

- **CAPTCHA** (e.g. Turnstile) on entry modal before `create-payment-intent`.
- **WAF** (Cloudflare, Vercel Attack Challenge).
- **Stripe Customer** + idempotency keys per checkout session.
- **Audit log** for admin actions.
- **Sentry** for error monitoring without logging card data.
- **CSP** header tuning in `vercel.json` if you add third-party scripts (Stripe needs `js.stripe.com`, `api.stripe.com`).

## If something goes wrong

- **Rotate** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ADMIN_JWT_SECRET`, PayPal secrets.
- In Stripe Dashboard: review **Payments** and **Logs** for suspicious PaymentIntents.
- Disable compromised admin password and set a new hash.
