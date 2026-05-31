import {
  TICKET_BUNDLES,
  DEFAULT_TICKET_BUNDLE_ID,
  LIVE_TEST_BUNDLE_ID,
  getTicketBundleById,
  getVisibleTicketBundles as getVisibleTicketBundlesShared,
  formatBundlePriceGBP,
} from '../shared/ticketBundles.mjs'

export {
  TICKET_BUNDLES,
  DEFAULT_TICKET_BUNDLE_ID,
  LIVE_TEST_BUNDLE_ID,
  getTicketBundleById,
  formatBundlePriceGBP,
}

/** Hides £0.05 test bundle in production unless VITE_LIVE_TEST_BUNDLE=1. */
export function getVisibleTicketBundles() {
  return getVisibleTicketBundlesShared(import.meta.env)
}
export { PAID_SKILL_QUESTIONS, validatePaidSkillAnswers } from '../shared/paidSkillQuestions.mjs'

export const BUNDLE_OFFER_ITEMS = [
  '2008 Cristiano Ronaldo signed shirt',
  'Cristiano Ronaldo Museum signed football',
  'iPhone 17 Pro Max',
  'iPhone 17 Pro Max 24K gold case',
]

export const GRAND_PRIZE_BUNDLE = {
  title: 'Ronaldo Legacy Bundle',
}

export {
  COMPETITION_NAME_POSTAL,
  POSTAL_ENTRY_ADDRESS,
  NO_PURCHASE_ENTRY_NOTICE,
  FOOTER_NO_PURCHASE_NOTICE,
  PROMOTER_NAME,
  PROMOTER_STREET,
  PROMOTER_POSTCODE,
  PROMOTER_ADDRESS_LINES,
} from '../shared/competitionCopy.mjs'
