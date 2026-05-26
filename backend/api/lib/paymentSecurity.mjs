import { getTicketBundleById } from '../../../shared/ticketBundles.mjs'

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
  const expectedCur = (
    process.env.PAYPAL_CURRENCY ||
    process.env.CASHFLOWS_CURRENCY ||
    'GBP'
  ).toUpperCase()
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
