import { loadStripe } from '@stripe/stripe-js'

let cachedKey = ''
/** @type {ReturnType<typeof loadStripe> | null} */
let stripePromise = null

/**
 * Single shared Stripe.js load — avoids reloading when the payment form mounts.
 * @param {string} publishableKey
 */
export function getStripePromise(publishableKey) {
  const key = (publishableKey ?? '').trim()
  if (!key) return null
  if (stripePromise && cachedKey === key) return stripePromise
  cachedKey = key
  stripePromise = loadStripe(key)
  return stripePromise
}

/** Warm Stripe.js as soon as the user may pay (modal open / page load). */
export function preloadStripe(publishableKey) {
  return getStripePromise(publishableKey)
}
