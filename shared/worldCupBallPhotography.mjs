import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from './worldCupBallGiveaway.mjs'
import {
  WINNER_PHOTOGRAPHY_VALID_REFUSAL_REASONS,
  WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS,
} from './winnerPhotographyConsent.mjs'

export const WORLD_CUP_BALL_PHOTOGRAPHY_INTRO =
  `If you win the ${WORLD_CUP_BALL_GIVEAWAY_LABEL}, you agree to provide a photograph of yourself with the football so we can announce the winner on our website and social media.`

export const WORLD_CUP_BALL_PHOTOGRAPHY_EMAIL_OPTION = `You may email your photo to ${SHOWSKILLS_CONTACT_EMAIL} instead of taking part in a live shoot, if that is easier.`

export const WORLD_CUP_BALL_PHOTOGRAPHY_REFUSAL =
  'You may refuse photography or video for valid reasons (for example medical, personal safety, religious, or serious privacy concerns) as set out in our Winner Photography & Promotional Consent in the Terms & Privacy Policy. Refusal without a valid reason may result in another winner being selected.'

/** Short block for rules, FAQ, and claim form. */
export const WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY = `${WORLD_CUP_BALL_PHOTOGRAPHY_INTRO} ${WORLD_CUP_BALL_PHOTOGRAPHY_EMAIL_OPTION} ${WORLD_CUP_BALL_PHOTOGRAPHY_REFUSAL}`

export function worldCupBallPhotographyFaqAnswer() {
  const reasons = WINNER_PHOTOGRAPHY_VALID_REFUSAL_REASONS.map((r) => `• ${r}`).join(' ')
  return `${WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY} Valid refusal reasons include: ${reasons}. ${WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS[4]}`
}
