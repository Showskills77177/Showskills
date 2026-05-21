import { loadStripe } from '@stripe/stripe-js'

let cachedKey = ''
/** @type {ReturnType<typeof loadStripe> | null} */
let stripePromise = null

/**
 * Loads Stripe.js v3 via @stripe/stripe-js (injects https://js.stripe.com/v3).
 * Resolves to the Stripe constructor or null if the key is missing / load fails.
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

/** Warm Stripe.js before the Payment Element mounts. */
export function preloadStripe(publishableKey) {
  return getStripePromise(publishableKey)
}

/**
 * Step 7 — confirm Stripe.js loaded before mounting Payment Element.
 * @param {string} publishableKey
 * @returns {Promise<boolean>}
 */
export async function assertStripeJsLoaded(publishableKey) {
  const stripe = await getStripePromise(publishableKey)
  if (!stripe) return false
  if (typeof window !== 'undefined' && typeof window.Stripe !== 'function') {
    console.error('[stripe] Stripe.js did not load — check ad blockers and network.')
    return false
  }
  return true
}
