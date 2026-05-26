# Deploying on Vercel (Hobby plan)

## Serverless function limit (12 max)

All API routes use **one** serverless function: `api/[[...slug]].js` → `lib/vercelApiDispatch.mjs`.

Do **not** add extra `.js` files under `api/` (each one becomes another function). Route table lives in `lib/`, not `api/`. The `archive/` folder is excluded via `.vercelignore`.

If deploy still fails with “more than 12 functions”, check the Vercel project for old files on the branch being deployed and ensure `api/stripe-webhook.js` and other legacy stubs are deleted.

## Cashflows + Apple Pay

1. Set `CASHFLOWS_*` and `VITE_CASHFLOWS_ENABLED=1` in Vercel env.
2. In **Cashflows Portal** → Configuration → Payment methods → Card: enable **Apple Pay** and add your domain (`showskills.co.uk`, not `www` unless you use it).
3. Host Apple’s domain verification file at `/.well-known/apple-developer-merchantid-domain-association` (Cashflows implementations team can provide the file).
4. Apple Pay appears on Safari / iOS when the device supports it; localhost will not show Apple Pay.

## PayPal

- **Embedded checkout (on-site card fields)** does not include PayPal in Cashflows’ JS library — only card, Apple Pay, and Google Pay.
- **PayPal button on our site** uses PayPal’s SDK and a **PayPal business account** (`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`). Funds settle in PayPal unless you use PayPal payouts manually.
- **Single settlement via Cashflows only**: use card / Apple Pay; skip PayPal env vars. For PayPal with Cashflows as acquirer, ask Cashflows about **Hosted Checkout** (redirect) with PayPal enabled in the portal.
