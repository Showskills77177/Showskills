/**
 * Minimum ticket sales policy — high-value draws vs low-value exceptions.
 * Shared across Terms, FAQs, checkout notices, and competition rules copy.
 */

/** Prizes at or below this retail value may proceed even if the sales target is not met (pence, GBP). */
export const MINIMUM_SALES_EXCEPTION_PRIZE_MAX_PENCE = 25000

export const MINIMUM_SALES_EXCEPTION_PRIZE_MAX_LABEL = '£250'

/** One-line summary for footnotes and compact UI. */
export const MINIMUM_SALES_POLICY_FOOTNOTE =
  'Most paid draws require minimum ticket sales to fund the prize — if not reached, all paid tickets for that period are refunded automatically. Low-value prizes (typically ' +
  MINIMUM_SALES_EXCEPTION_PRIZE_MAX_LABEL +
  ' or under) may still be awarded — see Terms & FAQs.'

/** Default rule — applies to most main prize draws (e.g. Signed Legacy Bundle, iPhone 17 Pro or Cash). */
export const MINIMUM_SALES_DEFAULT_RULE =
  'For most paid prize competitions on ShowSkills Rewards, each competition period has a minimum ticket sales target linked to the prize value shown on the site. ' +
  'If, when the entry period closes, paid ticket sales have not reached the amount required to fund that prize, we cancel the draw for that period and automatically refund every paid ticket purchase for that period in full to the original payment method. ' +
  'We will notify affected entrants by email. Free postal and free online (£0 verification) entries are not charged, so no payment refund applies to those routes.'

/** Exception — smaller prizes that may proceed without hitting the sales target. */
export const MINIMUM_SALES_EXCEPTION_RULE =
  'Some competitions are exempt from this cancellation and refund rule — usually where the prize retail value is ' +
  MINIMUM_SALES_EXCEPTION_PRIZE_MAX_LABEL +
  ' or less. For those draws, the prize may still be awarded even if the minimum sales target is not met, provided the draw goes ahead under the rules published on that competition page. ' +
  'Where an exception applies, we state it on the competition entry page and in these terms.'

/** Skill-quiz / change-of-mind non-refund — distinct from minimum-sales cancellation. */
export const TICKET_NON_REFUND_SKILL_AND_VOLUNTARY =
  'Apart from automatic refunds when a competition period is cancelled for insufficient ticket sales (see above), tickets are non-refundable once purchased — including if your skill answers are incorrect or you change your mind.'

/** Combined checkout / Stripe / PayPal notice. */
export const TICKET_PURCHASE_REFUND_POLICY_NOTICE =
  TICKET_NON_REFUND_SKILL_AND_VOLUNTARY + ' See Terms & FAQs for the minimum ticket sales policy.'

/** Terms section 10 — minimum sales block (plain text paragraphs). */
export const MINIMUM_SALES_TERMS_INTRO =
  'Each paid competition period may require a minimum level of ticket sales to fund the stated prize. The rules below apply in addition to the non-refund rules for incorrect skill answers.'

/** FAQ — dedicated minimum sales question. */
export function minimumSalesThresholdFaqAnswer() {
  return MINIMUM_SALES_DEFAULT_RULE + ' ' + MINIMUM_SALES_EXCEPTION_RULE
}

/** FAQ — refunds question (covers both minimum-sales refunds and skill-quiz non-refund). */
export function ticketRefundsFaqAnswer() {
  return (
    MINIMUM_SALES_DEFAULT_RULE +
    ' ' +
    MINIMUM_SALES_EXCEPTION_RULE +
    ' ' +
    TICKET_NON_REFUND_SKILL_AND_VOLUNTARY
  )
}

/** Competition rules markdown snippet (append to per-competition rules). */
export function minimumSalesRulesMarkdown({ exempt = false } = {}) {
  if (exempt) {
    return (
      '## Minimum ticket sales\n\n' +
      '- This competition may proceed and award the prize even if the minimum ticket sales target is not met, in line with our policy for prizes of ' +
      MINIMUM_SALES_EXCEPTION_PRIZE_MAX_LABEL +
      ' or less.\n' +
      '- ' +
      TICKET_NON_REFUND_SKILL_AND_VOLUNTARY
    )
  }
  return (
    '## Minimum ticket sales\n\n' +
    '- If paid ticket sales for this competition period do not reach the amount required to fund the prize, the draw is cancelled and **all paid tickets for that period are refunded automatically**.\n' +
    '- ' +
    TICKET_NON_REFUND_SKILL_AND_VOLUNTARY
  )
}
