# Deploying on Vercel (Hobby plan)

## Serverless function limit (12 max)

API routing uses **five** serverless functions (under the Hobby 12-function limit), all dispatching via `lib/vercelApiDispatch.mjs`:

| File | Paths |
|------|--------|
| `api/[[...slug]].js` | Flat routes, e.g. `/api/payment-config`, `/api/record-cashflows-payment` |
| `api/entries/[...slug].js` | `/api/entries/paid-quiz`, resume quiz, etc. |
| `api/admin/[...slug].js` | `/api/admin/login`, tickets, draw, … |
| `api/submissions/[...slug].js` | `/api/submissions/kickups` |
| `api/submissions/world-cup-ball/[...slug].js` | `/api/submissions/world-cup-ball/start`, submit, claim, claim-status, send-claim-link |
| `api/newsletter/[...slug].js` | `/api/newsletter/subscribe`, unsubscribe, preferences |

Do **not** add other `.js` files under `api/` without checking the function count. Handler logic lives in `backend/api/` and the route table in `lib/vercelApiDispatch.mjs`. The `archive/` folder is excluded via `.vercelignore`.

**Why not one catch-all?** On Vercel (non-Next), `api/[[...slug]].js` only reliably matches a **single** segment after `/api/`. Deeper paths (e.g. quiz save) return platform `NOT_FOUND` unless routed through a prefix catch-all above.

If deploy still fails with “more than 12 functions”, check the Vercel project for old files on the branch being deployed and ensure `api/stripe-webhook.js` and other legacy stubs are deleted.

## Cashflows + Apple Pay

1. Set `CASHFLOWS_*` and `VITE_CASHFLOWS_ENABLED=1` in Vercel env.
2. In **Cashflows Portal** → Configuration → Payment methods → Card: enable **Apple Pay** and add your domain (`showskills.co.uk`, not `www` unless you use it).
3. Email **implementations@cashflows.com** for the Apple Pay domain verification file. Place it at `public/.well-known/apple-developer-merchantid-domain-association` (copied into `dist` on build). It must return **200** as `text/plain`, not the SPA `index.html` — `vercel.json` excludes `/.well-known/` from the SPA rewrite.
4. **Mac Safari:** needs a card in **Wallet on this Mac** (or iPhone nearby with “Allow payments on Mac”). If the domain file is missing, Cashflows hides the Apple Pay button and only card iframes show — Safari autofill on the card field is **not** the same as Apple Pay and may prompt to add card details.
5. Apple Pay appears on Safari / iOS when the device and domain are fully set up; localhost will not show Apple Pay.
6. **Google Pay:** enable in Cashflows Portal, complete Google Pay Business Console, set `CASHFLOWS_GOOGLE_PAY_MERCHANT_ID` on Vercel. Shown on supported Android / Chrome when Cashflows returns ready.
7. **Samsung Pay** is not part of embedded checkout — see `docs/CASHFLOWS-TESTING.md`.

## PayPal

- **Embedded checkout (on-site card fields)** does not include PayPal in Cashflows’ JS library — only card, Apple Pay, and Google Pay.
- **PayPal button on our site** uses PayPal’s SDK and a **PayPal business account** (`PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET`). Funds settle in PayPal unless you use PayPal payouts manually.
- **Single settlement via Cashflows only**: use card / Apple Pay; skip PayPal env vars. For PayPal with Cashflows as acquirer, ask Cashflows about **Hosted Checkout** (redirect) with PayPal enabled in the portal.
