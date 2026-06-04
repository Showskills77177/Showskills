/** Winner photography & promotional consent — terms, privacy, FAQs, and emails. */

export const WINNER_PHOTOGRAPHY_CONSENT_TITLE = 'Winner Photography & Promotional Consent'

export const WINNER_PHOTOGRAPHY_CONSENT_INTRO =
  'By entering this competition, all participants agree that if they win, they may be asked to:'

/** @type {readonly string[]} */
export const WINNER_PHOTOGRAPHY_CONSENT_REQUESTS = [
  'Participate in a short photo or video shoot with the prize.',
  'Allow ShowSkills Rewards to use these photos and videos on our website, social media channels, and promotional materials.',
]

export const WINNER_PHOTOGRAPHY_CONSENT_PURPOSE =
  'This is for the purpose of announcing the winner and promoting future competitions.'

export const WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_HEADING = 'Important'

export const WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS = [
  'We will always respect your privacy.',
  'You have the right to refuse being photographed or filmed.',
  'If you refuse, you must provide a valid reason (for example: personal safety concerns, medical reasons, religious reasons, or other significant privacy issues).',
  'If you refuse without a valid reason, we reserve the right to select another winner.',
  'All photos and videos will only be used for promotional purposes related to ShowSkills Rewards and will not be sold to third parties.',
]

export const WINNER_PHOTOGRAPHY_VALID_REFUSAL_HEADING = 'Suggested valid reasons for refusal'

export const WINNER_PHOTOGRAPHY_VALID_REFUSAL_INTRO =
  'Valid reasons for refusing photography may include:'

/** @type {readonly string[]} */
export const WINNER_PHOTOGRAPHY_VALID_REFUSAL_REASONS = [
  'Medical or health-related concerns',
  'Personal safety or security issues',
  'Religious or cultural beliefs',
  'Severe privacy concerns',
]

/** One paragraph for bundle legal notices and cross-references. */
export const WINNER_PHOTOGRAPHY_BUNDLE_TERMS_SUMMARY =
  'If you win, you may be asked to take part in a short photo or video shoot with the prize for winner announcements and ShowSkills Rewards promotions. You may refuse for valid reasons (see Winner Photography & Promotional Consent in our Terms). Refusal without a valid reason may result in another winner being selected. Promotional photos and videos are not sold to third parties.'

/** Full FAQ answer (plain text). */
export function winnerPhotographyConsentFaqAnswer() {
  const bullets = WINNER_PHOTOGRAPHY_CONSENT_REQUESTS.map((b) => `• ${b}`).join(' ')
  const important = WINNER_PHOTOGRAPHY_CONSENT_PRIVACY_POINTS.join(' ')
  const reasons = WINNER_PHOTOGRAPHY_VALID_REFUSAL_REASONS.map((r) => `• ${r}`).join(' ')
  return (
    `${WINNER_PHOTOGRAPHY_CONSENT_INTRO} ${bullets} ${WINNER_PHOTOGRAPHY_CONSENT_PURPOSE} ` +
    `${important} ${WINNER_PHOTOGRAPHY_VALID_REFUSAL_INTRO} ${reasons} ` +
    'Full rules are in our Terms & Privacy Policy under Winner Photography & Promotional Consent.'
  )
}
