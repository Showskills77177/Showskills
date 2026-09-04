import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_ANSWER_STYLE_INSTRUCTION,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_QUESTION_TIMING_NOTICE,
  WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION,
} from './worldCupBallGiveaway.mjs'
import { WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY } from './worldCupBallPhotography.mjs'
import {
  WORLD_CUP_BALL_INTERNATIONAL_CASH_NOTICE,
  WORLD_CUP_BALL_INTERNATIONAL_ENTRY_NOTICE,
} from './worldCupBallInternationalPrize.mjs'
import {
  WORLD_CUP_BALL_MONTHLY_DRAW_SUMMARY,
  WORLD_CUP_BALL_MONTHLY_DRAW_SHORT,
} from './worldCupBallMonthlyDraw.mjs'

export const WORLD_CUP_BALL_GIVEAWAY_PAGE_ID = 'world_cup_ball_giveaway'

export const WORLD_CUP_BALL_MIN_AGE = 16

/** Enforcement is by public IP — Wi‑Fi, hotspot, and mobile data each count as one connection. */
export const WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT =
  'One quiz attempt per internet connection (IP address)'

export const WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE =
  `${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT}. Devices on the same Wi‑Fi or mobile hotspot share that limit — you cannot take separate attempts on a phone and a PC using the same connection.`

export const WORLD_CUP_BALL_CONNECTION_USED_ERROR =
  `This internet connection has already been used for the ${WORLD_CUP_BALL_GIVEAWAY_LABEL}. Only one quiz attempt is allowed per IP address (shared Wi‑Fi or hotspot counts as one connection).`

export const WORLD_CUP_BALL_FREE_SHIPPING_NOTICE =
  'Prize delivery is free within the United Kingdom to the UK postal address you provide after you win.'

/** Short hero / card copy — no legal repetition. */
export const WORLD_CUP_BALL_PAGE_INTRO =
  `Win an official-style FIFA World Cup football (2026 design, not signed) by passing a free ${WORLD_CUP_BALL_QUESTION_COUNT}-question skill quiz — or USD $30 cash if you win from outside the UK. Separate from our paid prize draws and the Ronaldo shirt giveaway.`

export const WORLD_CUP_BALL_RULES_INTRO =
  `${WORLD_CUP_BALL_PAGE_INTRO} ${WORLD_CUP_BALL_MONTHLY_DRAW_SHORT}`

export const WORLD_CUP_BALL_ELIGIBILITY_NOTICE =
  `${WORLD_CUP_BALL_INTERNATIONAL_ENTRY_NOTICE} Genuine skill promotion — not gambling or a lottery. If you are 16 or 17 and win, fulfilment must go to a parent or legal guardian's mailing address with their contact details.`

export const WORLD_CUP_BALL_CONNECTION_AND_VPN_NOTICE =
  `${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE} VPNs, proxies, and similar anonymising tools are not allowed.`

/** Compact summary for cards and entry modal. */
export const WORLD_CUP_BALL_SKILL_NOTICE =
  `${WORLD_CUP_BALL_QUESTION_COUNT} timed questions — all correct to win. Miss exactly one and you get one salvage question.`

/** Timing, question types, and marking — stated once in terms. */
export const WORLD_CUP_BALL_GAMEPLAY_NOTICE =
  `${WORLD_CUP_BALL_QUESTION_TIMING_NOTICE} ${WORLD_CUP_BALL_CHOICE_BONUS_NOTICE} ${WORLD_CUP_BALL_ANSWER_STYLE_INSTRUCTION} Minor spelling differences are accepted when the answer is clearly correct.`

export const WORLD_CUP_BALL_TERMS_AD_GATE_NOTICE =
  'You must watch a short ad video in full before you can start the practice question and the real quiz — there is no skip, close, or manual-unlock option. A second practice question is optional and only unlocks if you choose to watch a second ad video in full.'

export const WORLD_CUP_BALL_TERMS_SALVAGE_NOTICE =
  `One wrong answer in the main quiz unlocks one bonus salvage question (${WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION}). Answer it correctly to win. A second wrong answer ends the attempt immediately. A second time-out on any question also disqualifies you.`

/** @deprecated Use WORLD_CUP_BALL_GAMEPLAY_NOTICE in new copy. */
export const WORLD_CUP_BALL_TERMS_TIMING_NOTICE = WORLD_CUP_BALL_QUESTION_TIMING_NOTICE

export const WORLD_CUP_BALL_TERMS_FAIL_REVIEW_NOTICE =
  'If you do not win, we show which main questions you missed and what you typed — in your browser only, not by email.'

export const WORLD_CUP_BALL_TERMS_WIN_NOTICE =
  `If you win (including via salvage), complete the prize fulfilment form with your full name, email, contact phone, country, and mailing address.`

export const WORLD_CUP_BALL_WINNER_DETAILS_NOTICE =
  `${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} ${WORLD_CUP_BALL_INTERNATIONAL_CASH_NOTICE} Entrants aged 16–17 must provide a parent or guardian's delivery details. We send a winner email with a link to return to the form if needed. Each name, email, phone, and address may only be used once — we cannot fulfil the prize without your details.`

export const WORLD_CUP_BALL_WINNER_EMAIL_REMINDER =
  'The winner email includes a secure link back to the delivery form until your details are saved.'

/** Single winner block for terms and rules pages. */
export const WORLD_CUP_BALL_WINNER_NOTICE =
  `${WORLD_CUP_BALL_TERMS_WIN_NOTICE} ${WORLD_CUP_BALL_WINNER_DETAILS_NOTICE} ${WORLD_CUP_BALL_WINNER_EMAIL_REMINDER}`

/** Non-overlapping blocks for the site-wide Terms modal (section 6a). */
export const WORLD_CUP_BALL_TERMS_SECTIONS = [
  { title: 'Overview', body: WORLD_CUP_BALL_RULES_INTRO },
  { title: 'Eligibility', body: WORLD_CUP_BALL_ELIGIBILITY_NOTICE },
  { title: 'One attempt per connection & VPN', body: WORLD_CUP_BALL_CONNECTION_AND_VPN_NOTICE },
  {
    title: 'How the quiz works',
    body: `${WORLD_CUP_BALL_GAMEPLAY_NOTICE} ${WORLD_CUP_BALL_TERMS_AD_GATE_NOTICE} ${WORLD_CUP_BALL_TERMS_SALVAGE_NOTICE}`,
  },
  {
    title: 'If you do not win',
    body: `${WORLD_CUP_BALL_TERMS_FAIL_REVIEW_NOTICE} ${WORLD_CUP_BALL_MONTHLY_DRAW_SUMMARY}`,
  },
  { title: 'If you win', body: WORLD_CUP_BALL_WINNER_NOTICE },
  { title: 'Mandatory winning-cheque photo', body: WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY },
]

/** Numbered steps for the public rules page. */
export const WORLD_CUP_BALL_PUBLIC_STEPS = [
  {
    num: 1,
    title: 'Start the quiz',
    detail: `Open the challenge from this page or Competitions. You must be at least ${WORLD_CUP_BALL_MIN_AGE} and eligible in your country. Turn off any VPN or proxy. Watching a short ad video in full is mandatory before the practice question unlocks — there is no skip or bypass.`,
  },
  {
    num: 2,
    title: `${WORLD_CUP_BALL_QUESTION_COUNT} difficult questions under time pressure`,
    detail: `${WORLD_CUP_BALL_CHOICE_BONUS_NOTICE} ${WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION}. If a time-out expires once, you get ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS} extra seconds on that question only.`,
  },
  {
    num: 3,
    title: 'Win, salvage, or monthly draw',
    detail:
      'All correct wins the ball outright. One wrong answer gives a salvage question — answer it correctly to win. Two wrong answers end the attempt; you still get one free entry into that month’s draw (June or July 2026).',
  },
  {
    num: 4,
    title: 'Complete the winner fulfilment form',
    detail:
      'If you win, complete the form with your name, email, phone, country, and mailing address. UK winners get free ball delivery; international winners receive USD $30 cash.',
  },
  {
    num: 5,
    title: 'Mandatory winning-cheque photo',
    detail: WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY,
  },
]

/** @deprecated Use WORLD_CUP_BALL_TERMS_SECTIONS — kept for CMS/admin previews if referenced elsewhere. */
export const WORLD_CUP_BALL_RULES_SECTIONS = WORLD_CUP_BALL_TERMS_SECTIONS

export function defaultWorldCupBallGiveawayPageLayout() {
  return {
    version: 1,
    badge: 'Free skill giveaway · Not signed',
    title: WORLD_CUP_BALL_GIVEAWAY_LABEL,
    intro: WORLD_CUP_BALL_PAGE_INTRO,
    ctaButtonLabel: 'Enter the quiz',
    howToTitle: 'How to win',
  }
}

export function mergeWorldCupBallGiveawayPageLayout(input) {
  const base = defaultWorldCupBallGiveawayPageLayout()
  if (!input || typeof input !== 'object') return base
  return {
    ...base,
    badge: typeof input.badge === 'string' ? input.badge : base.badge,
    title: typeof input.title === 'string' ? input.title : base.title,
    intro: typeof input.intro === 'string' ? input.intro : base.intro,
    ctaButtonLabel: typeof input.ctaButtonLabel === 'string' ? input.ctaButtonLabel : base.ctaButtonLabel,
    howToTitle: typeof input.howToTitle === 'string' ? input.howToTitle : base.howToTitle,
  }
}
