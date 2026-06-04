import { DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'

/** Competition names shown on entry forms, postal instructions, and FAQs. */
export const COMPETITION_NAME_POSTAL = `${DRAW_COMPETITION_LABEL} — ShowSkills Rewards`

/** Promoter / postal entry address (UK). */
export const PROMOTER_NAME = 'ShowSkills Rewards'
export const PROMOTER_STREET = '35 Irvine Street'
export const PROMOTER_POSTCODE = 'L7 8SY'

/** One-line address for terms, FAQs, and “post to” copy. */
export const POSTAL_ENTRY_ADDRESS = `${PROMOTER_NAME}, ${PROMOTER_STREET}, ${PROMOTER_POSTCODE}`

/** Core UK skill-promotion notice — terms, FAQ, privacy (no “see terms” suffix). */
export const NO_PURCHASE_ENTRY_NOTICE =
  'No purchase necessary. Free entry available by post and by £0 debit card verification online — ShowSkills Rewards does not collect or store your debit card details from free entry.'

/** Footer — includes pointer to full terms. */
export const FOOTER_NO_PURCHASE_NOTICE =
  `${NO_PURCHASE_ENTRY_NOTICE} See Full terms & privacy for the postal address and full rules.`

/** Multi-line address for forms and contact panels. */
export const PROMOTER_ADDRESS_LINES = [PROMOTER_NAME, PROMOTER_STREET, PROMOTER_POSTCODE]
