import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'

/**
 * Server-side check: PaymentIntent amount/metadata must match our bundle catalog.
 * Prevents tampered client requests from recording wrong prices or bundles.
 */
export function assertPaymentIntentMatchesBundle(intent, bundleId) {
  const bundle = getTicketBundleById(bundleId)
  if (!bundle) {
    return { ok: false, error: 'Invalid bundleId' }
  }

  const md = intent.metadata || {}
  const metaBundle = typeof md.bundle_id === 'string' ? md.bundle_id.trim() : ''
  if (metaBundle && metaBundle !== bundle.id) {
    return { ok: false, error: 'Payment bundle does not match order' }
  }

  const metaQty = Math.max(0, parseInt(String(md.ticket_quantity ?? ''), 10) || 0)
  if (metaQty > 0 && metaQty !== bundle.qty) {
    return { ok: false, error: 'Payment ticket quantity does not match bundle' }
  }

  const expectedAmount = bundle.totalPence
  const actual = intent.amount_received ?? intent.amount
  if (typeof actual === 'number' && actual !== expectedAmount) {
    return { ok: false, error: 'Payment amount does not match bundle price' }
  }

  const currency = (intent.currency || 'gbp').toLowerCase()
  const expectedCurrency = (process.env.STRIPE_CURRENCY || 'gbp').toLowerCase()
  if (currency !== expectedCurrency) {
    return { ok: false, error: 'Unexpected payment currency' }
  }

  return { ok: true, bundle }
}

/**
 * PayPal capture amount must match catalog bundle (client cannot lower price).
 */
export function assertPayPalCaptureMatchesBundle(captureData, bundleId, ticketQuantity) {
  const bundle = getTicketBundleById(bundleId)
  if (!bundle) {
    return { ok: false, error: 'Invalid bundleId' }
  }

  const qty = Math.max(1, parseInt(String(ticketQuantity), 10) || 0)
  if (qty !== bundle.qty) {
    return { ok: false, error: 'Ticket quantity does not match bundle' }
  }

  const cap = captureData?.purchase_units?.[0]?.payments?.captures?.[0]
  const cur = (cap?.amount?.currency_code || 'GBP').toUpperCase()
  const expectedCur = (process.env.PAYPAL_CURRENCY || process.env.STRIPE_CURRENCY || 'GBP').toUpperCase()
  if (cur !== expectedCur) {
    return { ok: false, error: 'Unexpected payment currency' }
  }

  const val = cap?.amount?.value
  if (val == null) {
    return { ok: false, error: 'Missing capture amount' }
  }
  const amountPence = Math.round(parseFloat(String(val), 10) * (cur === 'JPY' ? 1 : 100))
  if (amountPence !== bundle.totalPence) {
    return { ok: false, error: 'Payment amount does not match bundle price' }
  }

  const customId = captureData?.purchase_units?.[0]?.custom_id || ''
  if (typeof customId === 'string' && customId.includes('|') && !customId.includes(bundle.id)) {
    return { ok: false, error: 'Payment bundle does not match order' }
  }

  return { ok: true, bundle, amountPence, currency: cur.toLowerCase() }
}
