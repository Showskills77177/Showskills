import {
  TICKET_PURCHASE_REFUND_POLICY_NOTICE,
} from './competitionMinimumSalesPolicy.mjs'

/** Paid ticket checkout — same wording on site, payment providers, and Terms. */
export const TICKET_PURCHASE_NON_REFUND_NOTICE = TICKET_PURCHASE_REFUND_POLICY_NOTICE

/** Compact checkout reminder — skill quiz + refund policy (entry modal footer). */
export const LEGACY_ENTRY_CHECKOUT_NOTICE =
  'One attempt at the three skill questions per entry. Tickets are non-refundable except if the draw is cancelled for insufficient ticket sales (see Terms).'
