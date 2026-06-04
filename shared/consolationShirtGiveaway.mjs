/** Automatic shirt giveaway entries when Signed Football Legend Bundle skill answers are incorrect. */
export const CONSOLATION_SHIRT_ENTRY_COUNT = 2

/** Paid ticket bundles must total at least this (pence) — £10 or more. */
export const CONSOLATION_MIN_SPEND_PENCE = 1000

export function paidSpendQualifiesForConsolation(amountPence) {
  return Number.isFinite(amountPence) && amountPence >= CONSOLATION_MIN_SPEND_PENCE
}

export const LEGACY_SKILL_ONE_ATTEMPT_NOTICE =
  'You have one attempt at the three skill questions for each entry. Take your time — answers cannot be changed after you submit.'

export const CONSOLATION_PRIZE_SUMMARY =
  'If you get the skill questions wrong, you automatically receive 2 entries into the separate Free Ronaldo Shirt Giveaway (consolation prize). This does not qualify you for the main Signed Football Legend Bundle draw.'

export const CONSOLATION_PRIZE_PAID_THRESHOLD =
  'For paid ticket purchases, consolation shirt entries apply when you spend £10 or more on tickets in a single purchase and get the skill questions wrong.'

export const CONSOLATION_PRIZE_FREE_APPLIES =
  'Free online Signed Football Legend Bundle entrants who get the skill questions wrong receive the same 2 consolation shirt entries (no spend threshold).'

export const CONSOLATION_NO_REFUND_REMINDER =
  'Tickets are not refunded if your skill answers are incorrect.'

/** @param {{ entryCount?: number }} [opts] */
export function formatConsolationAwardMessage({ entryCount = CONSOLATION_SHIRT_ENTRY_COUNT } = {}) {
  if (!entryCount || entryCount < 1) return null
  const noun = entryCount === 1 ? 'entry' : 'entries'
  return `As a consolation prize, you have received ${entryCount} automatic ${noun} into the separate Free Ronaldo Shirt Giveaway. This does not enter you into the main Signed Football Legend Bundle draw. ${CONSOLATION_NO_REFUND_REMINDER}`
}

export const CONSOLATION_NOT_AWARDED_PAID_BELOW_THRESHOLD =
  'You do not qualify for the main Signed Football Legend Bundle draw on this attempt. Consolation shirt entries apply only when you spend £10 or more on tickets in a single purchase. Tickets are not refunded.'

export const CONSOLATION_NOT_AWARDED_GENERIC =
  'You do not qualify for the main Signed Football Legend Bundle draw on this attempt. Tickets are not refunded.'
