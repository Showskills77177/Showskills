/** Archived — Stripe Checkout / PaymentIntent helpers. */

export const STRIPE_CHECKOUT_DESCRIPTION_MAX = 500
export const STRIPE_METADATA_VALUE_MAX = 500

export function buildStripePaymentMetadata({ bundleId, qty, customerFullName = '' }) {
  return {
    competition: 'ronaldo_legacy_bundle',
    bundle_id: String(bundleId || '').slice(0, 80),
    ticket_quantity: String(Math.max(1, parseInt(String(qty), 10) || 1)),
    customer_full_name: String(customerFullName || '').slice(0, 200),
  }
}
