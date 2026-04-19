/**
 * Paid draw ticket bundles — single source of truth for UI + Stripe/PayPal APIs.
 * Amounts in pence (GBP). Server must resolve `bundleId` against this list only.
 */
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
