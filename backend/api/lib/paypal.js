/**
 * Shared PayPal REST helpers for Vercel serverless routes.
 */

export function getPayPalCredentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const live = process.env.PAYPAL_MODE === 'live'
  const apiBase =
    process.env.PAYPAL_API_BASE ||
    (live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')
  return { clientId, clientSecret, apiBase }
}

export function getCheckoutCurrency() {
  return (process.env.PAYPAL_CURRENCY || process.env.STRIPE_CURRENCY || 'gbp').toUpperCase()
}

export async function paypalAccessToken(cfg) {
  const auth = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')
  const r = await fetch(`${cfg.apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    throw new Error(j.error_description || j.error || 'PayPal OAuth failed')
  }
  return j.access_token
}
