/** Stripe Checkout product description limit (display). */
export const STRIPE_CHECKOUT_DESCRIPTION_MAX = 500

/** PayPal purchase unit description limit. */
export const PAYPAL_CHECKOUT_DESCRIPTION_MAX = 127

/**
 * Compact ticket list for payment provider descriptions (may truncate).
 * @param {string[]} ticketNumbers
 * @param {number} maxLength
 */
export function formatTicketListForCheckoutDescription(ticketNumbers, maxLength = 500) {
  const list = Array.isArray(ticketNumbers) ? ticketNumbers.filter(Boolean) : []
  if (!list.length) return ''

  const prefix = 'Tickets: '
  const join = (nums) => nums.join(', ')
  let compact = join(list)
  if (prefix.length + compact.length <= maxLength) return prefix + compact

  let shown = []
  for (const num of list) {
    const next = shown.length ? join([...shown, num]) : num
    const suffix = ` (+${list.length - shown.length - 1} more)`
    if (prefix.length + next.length + (shown.length < list.length - 1 ? suffix.length : 0) > maxLength) {
      break
    }
    shown.push(num)
  }

  if (!shown.length) {
    const first = list[0]
    const suffix = list.length > 1 ? ` (+${list.length - 1} more)` : ''
    const room = maxLength - prefix.length
    if (first.length + suffix.length <= room) return prefix + first + suffix
    return prefix + first.slice(0, Math.max(0, room - suffix.length)) + suffix
  }

  const remaining = list.length - shown.length
  compact = join(shown) + (remaining > 0 ? ` (+${remaining} more)` : '')
  return prefix + compact
}

/**
 * Build line description for Stripe / PayPal with ticket numbers prioritized.
 */
export function buildCheckoutDescription({
  bundleSummary,
  ticketNumbers,
  nonRefundNotice,
  maxLength,
}) {
  const ticketsPart = formatTicketListForCheckoutDescription(ticketNumbers, maxLength)
  const parts = [ticketsPart, bundleSummary, nonRefundNotice].filter(Boolean)
  let desc = parts.join('. ')
  if (desc.length <= maxLength) return desc

  if (ticketsPart) {
    const room = maxLength - (nonRefundNotice ? nonRefundNotice.length + 2 : 0)
    const ticketsOnly = formatTicketListForCheckoutDescription(ticketNumbers, room)
    desc = [ticketsOnly, nonRefundNotice].filter(Boolean).join('. ')
    if (desc.length <= maxLength) return desc
    return ticketsOnly.slice(0, maxLength)
  }

  return desc.slice(0, maxLength)
}
