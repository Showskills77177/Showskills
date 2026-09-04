import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from './worldCupBallGiveaway.mjs'
import { WORLD_CUP_BALL_INTERNATIONAL_CASH_USD } from './worldCupBallInternationalPrize.mjs'
import { WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS } from './winnerPhotographyConsent.mjs'

export const WORLD_CUP_BALL_PHOTOGRAPHY_EMAIL_OPTION = `You may email your photo to ${SHOWSKILLS_CONTACT_EMAIL} instead of taking part in a live shoot, if that is easier.`

export const WORLD_CUP_BALL_WINNING_CHECK_PHOTO_INTRO =
  `Every winner of the ${WORLD_CUP_BALL_GIVEAWAY_LABEL} must provide a clear photograph of themselves holding their official ShowSkills winning cheque.`

const WORLD_CUP_BALL_WINNING_CHECK_PHOTO_INTRO_CASH =
  `Every winner of the ${WORLD_CUP_BALL_GIVEAWAY_LABEL} must provide a clear photograph of themselves holding the official ShowSkills winning cheque for USD $${WORLD_CUP_BALL_INTERNATIONAL_CASH_USD}.`

export const WORLD_CUP_BALL_WINNING_CHECK_PHOTO_MANDATORY = `This winning-cheque photograph is required from every winner. If you are unable or unwilling to provide it, you must email ${SHOWSKILLS_CONTACT_EMAIL} with your official reason so we can review your case — otherwise, refusal or failure to provide it forfeits the prize and we may select another winner.`

export const WORLD_CUP_BALL_WINNING_CHECK_PHOTO_SUMMARY = `${WORLD_CUP_BALL_WINNING_CHECK_PHOTO_INTRO} ${WORLD_CUP_BALL_WINNING_CHECK_PHOTO_MANDATORY} ${WORLD_CUP_BALL_PHOTOGRAPHY_EMAIL_OPTION}`

/** @deprecated Use WORLD_CUP_BALL_WINNING_CHECK_PHOTO_SUMMARY */
export const WORLD_CUP_BALL_INTERNATIONAL_WINNING_CHECK_PHOTO_SUMMARY = WORLD_CUP_BALL_WINNING_CHECK_PHOTO_SUMMARY

/** Short block for rules, FAQ, claim form, and terms. */
export const WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY = WORLD_CUP_BALL_WINNING_CHECK_PHOTO_SUMMARY

/** @param {'uk_ball' | 'international_cash'} [fulfilment] */
export function worldCupBallPhotographySummaryForFulfilment(fulfilment) {
  const intro =
    fulfilment === 'international_cash' ? WORLD_CUP_BALL_WINNING_CHECK_PHOTO_INTRO_CASH : WORLD_CUP_BALL_WINNING_CHECK_PHOTO_INTRO
  return `${intro} ${WORLD_CUP_BALL_WINNING_CHECK_PHOTO_MANDATORY} ${WORLD_CUP_BALL_PHOTOGRAPHY_EMAIL_OPTION}`
}

export function worldCupBallPhotographyFaqAnswer() {
  return `${WORLD_CUP_BALL_WINNING_CHECK_PHOTO_SUMMARY} ${WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS[4]}`
}
