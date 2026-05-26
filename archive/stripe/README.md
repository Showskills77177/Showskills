# Archived Stripe integration

ShowSkills no longer uses Stripe for payments. Card checkout is **Cashflows Embedded Checkout**; PayPal remains optional.

This folder preserves the previous Stripe implementation for reference, seed scripts, and any legacy data in the database (`stripe_session_id`, `stripe_payment_intent_id` columns on `tickets` are retained).

## Contents

| Path | Purpose |
|------|---------|
| `backend/api/` | Hosted Checkout, Payment Element, webhooks, free-entry card verify |
| `backend/api/records/stripe-session.js` | Post-redirect session recording |
| `backend/api/lib/paymentSecurity.mjs` | PaymentIntent amount checks |
| `backend/lib/recordSaleStripe.mjs` | `recordStripeCheckoutCompleted`, `recordStripePaymentIntentCompleted` |
| `src/components/` | `StripePaymentForm`, `StripeSetupForm`, `StripeReturnOverlay` |
| `src/lib/` | Stripe.js loader, appearance, focus compat |
| `api/stripe-webhook.js` | Vercel serverless re-export (removed from live routes) |

## Restoring (not recommended)

You would need to re-add routes in `api/_dispatch.mjs`, restore npm packages `@stripe/stripe-js`, `@stripe/react-stripe-js`, `stripe`, and wire the frontend again. Prefer Cashflows instead.

## E2E / seeds

- `scripts/seed-draw-pool.mjs` and `scripts/seed-ronaldo-bundle-test3-bulk.mjs` import from `archive/stripe/backend/lib/recordSaleStripe.mjs`.
- Local E2E uses `/api/e2e/mock-paid-completion` (Cashflows-shaped), not Stripe mocks.
