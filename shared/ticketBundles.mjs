/**
 * Paid draw ticket bundles — single source of truth for UI + Stripe/PayPal APIs.
 * Amounts in pence (GBP). Server must resolve `bundleId` against this list only.
 */

/** Volume rate for the £25 mega tier (pence per ticket). */
export const MEGA_BUNDLE_PENCE_PER_TICKET = 40

/** £25 at 40p per ticket → floor(2500 ÷ 40) = 62 tickets (customer pays £25). */
export const MEGA_BUNDLE_TOTAL_PENCE = 2500
export const MEGA_BUNDLE_TICKET_QTY = Math.floor(
  MEGA_BUNDLE_TOTAL_PENCE / MEGA_BUNDLE_PENCE_PER_TICKET,
)

export const TICKET_BUNDLES = [
  {
    id: 'single',
    qty: 1,
    totalPence: 75,
    emoji: '🎟️',
    title: 'Single',
    line1: '1 ticket = £0.75',
    line2: null,
    bullets: [],
    featured: false,
  },
  {
    id: 'small5',
    qty: 5,
    totalPence: 350,
    emoji: '🔥',
    title: 'Small bundle',
    line1: '5 tickets = £3.50',
    line2: '£0.70 per ticket',
    bullets: ['Small discount', 'Easy entry'],
    featured: false,
  },
  {
    id: 'medium10',
    qty: 10,
    totalPence: 600,
    emoji: '💥',
    title: 'Medium bundle',
    line1: '10 tickets = £6',
    line2: '£0.60 per ticket',
    bullets: ['Most important — best balance of price vs entries'],
    featured: true,
  },
  {
    id: 'bigger20',
    qty: 20,
    totalPence: 1000,
    emoji: '🚀',
    title: 'Bigger bundle',
    line1: '20 tickets = £10',
    line2: '£0.50 per ticket',
    bullets: [],
    featured: false,
  },
  {
    id: 'whale40',
    qty: 40,
    totalPence: 1800,
    emoji: '🧠',
    title: 'Whale bundle',
    line1: '40 tickets = £18',
    line2: '£0.45 per ticket',
    bullets: [],
    featured: false,
  },
  {
    id: 'mega25',
    qty: MEGA_BUNDLE_TICKET_QTY,
    totalPence: MEGA_BUNDLE_TOTAL_PENCE,
    emoji: '🏆',
    title: 'Mega bundle',
    line1: `£25 — ${MEGA_BUNDLE_TICKET_QTY} tickets`,
    line2: `40p per ticket (${MEGA_BUNDLE_TICKET_QTY} × 40p = £24.80, pay £25)`,
    bullets: ['Best volume rate — pay £25 for 62 entries at the 40p rate'],
    featured: false,
  },
]

export const DEFAULT_TICKET_BUNDLE_ID = TICKET_BUNDLES[0].id

export function getTicketBundleById(id) {
  const s = typeof id === 'string' ? id.trim() : ''
  return TICKET_BUNDLES.find((b) => b.id === s) ?? null
}

export function formatBundlePriceGBP(totalPence) {
  const pounds = totalPence / 100
  if (Number.isInteger(pounds)) return `£${pounds}`
  return `£${pounds.toFixed(2)}`
}
