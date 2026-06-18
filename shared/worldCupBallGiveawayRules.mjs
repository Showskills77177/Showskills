import {
  WORLD_CUP_BALL_PRIZE_DETAIL,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_MAX_TIMEOUTS,
  WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS,
  WORLD_CUP_BALL_SALVAGE_NOTICE,
} from './worldCupBallGiveaway.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY } from './worldCupBallPhotography.mjs'

export const WORLD_CUP_BALL_GIVEAWAY_PAGE_ID = 'world_cup_ball_giveaway'

export const WORLD_CUP_BALL_MIN_AGE = 16

/** Enforcement is by public IP — Wi‑Fi, hotspot, and mobile data each count as one connection. */
export const WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT =
  'One quiz attempt per internet connection (IP address)'

export const WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE =
  `${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT}. Devices on the same Wi‑Fi or mobile hotspot share that limit — you cannot take separate attempts on a phone and a PC using the same connection.`

export const WORLD_CUP_BALL_CONNECTION_USED_ERROR =
  'This internet connection has already been used for the World Cup Ball Giveaway. Only one quiz attempt is allowed per IP address (shared Wi‑Fi or hotspot counts as one connection).'

export const WORLD_CUP_BALL_FREE_SHIPPING_NOTICE =
  'Prize delivery is free within the United Kingdom. We ship the official-style World Cup football to the UK postal address you provide after you win — there is no delivery charge for the winner.'

export const WORLD_CUP_BALL_ELIGIBILITY_NOTICE =
  `Open to UK residents aged ${WORLD_CUP_BALL_MIN_AGE} or over. This is a free skill challenge, not gambling or a lottery. ${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE} VPNs, proxies, and similar anonymising tools are not allowed. Entrants aged 16 or 17 may take part, but prize delivery must go to a parent or legal guardian’s UK postal address with their contact details (see Winner details below).`

export const WORLD_CUP_BALL_RULES_INTRO =
  `This is a free, skill-based giveaway for one official-style FIFA World Cup football (2026 tournament design, not signed). It is separate from our paid prize draws and the Ronaldo shirt giveaway. You must answer all ${WORLD_CUP_BALL_QUESTION_COUNT} difficult football questions correctly — under strict time limits — to win outright, or answer exactly one incorrectly and then answer one bonus salvage question correctly. There is no random draw. ${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT}. At least ${WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS} questions are multiple-choice bonus questions with four options; the rest are free-text. ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} VPNs are not permitted.`

export const WORLD_CUP_BALL_SKILL_NOTICE =
  `This promotion is a genuine skill challenge, not a lottery. Success depends on your football knowledge and speed. Minor spelling or grammar differences are accepted when the answer is clearly correct. ${WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE} One incorrect answer gives you one bonus salvage question — answer it correctly to still win. Two or more incorrect answers, a second timeout, or use of a VPN means you do not win the ball.`

export const WORLD_CUP_BALL_TERMS_TIMING_NOTICE =
  `Each question has a ${WORLD_CUP_BALL_QUESTION_SECONDS}-second timer. The first time you exceed the limit on a question, you receive a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second bonus on that question only. A second timeout on any question disqualifies your attempt. ${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT}. VPNs and proxies are not allowed.`

export const WORLD_CUP_BALL_TERMS_SALVAGE_NOTICE =
  `If you answer exactly one of the ${WORLD_CUP_BALL_QUESTION_COUNT} main questions incorrectly, you receive one bonus salvage question that was not part of your original quiz. ${WORLD_CUP_BALL_SALVAGE_NOTICE} The salvage question is subject to the same time limits. Two or more incorrect answers in the main quiz end your attempt without a salvage question.`

export const WORLD_CUP_BALL_TERMS_FAIL_REVIEW_NOTICE =
  'If you do not win, we show you which main quiz questions you answered incorrectly and the answers you submitted. This feedback is displayed to you in your browser during the attempt only — it is not emailed automatically.'

export const WORLD_CUP_BALL_TERMS_WIN_NOTICE =
  `If you win (including after a successful salvage question), you must complete the prize delivery form with your full name, email, UK mobile number, and UK postal address so we can ship the football. Entrants aged ${WORLD_CUP_BALL_MIN_AGE}–17 must also provide a parent or legal guardian's name, mobile number, and UK delivery address.`

export const WORLD_CUP_BALL_WINNER_DETAILS_NOTICE =
  `If you win, you must complete the prize delivery form straight away with your full name, email, UK mobile number, and UK postal address so we can ship the ball (${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE.toLowerCase()}). Entrants aged 16 or 17 must also provide a parent or legal guardian’s full name, mobile number, and UK delivery address. We send a formal winner email to the address you provide. That email includes a personal link so you can return to the form if you need to finish later — once your details are saved, the link confirms delivery information is on file. Each name, email, mobile number, and postal address may only be used once for this giveaway. If you do not provide your details, we cannot send the prize.`

export const WORLD_CUP_BALL_WINNER_EMAIL_REMINDER =
  `Your winner email includes a secure link back to the delivery form. If you have not yet submitted your details, the email will ask you to complete the form so we can ship your football. Once submitted, the same link confirms your details are saved.`

/** Numbered steps for the rules page. */
export const WORLD_CUP_BALL_PUBLIC_STEPS = [
  {
    num: 1,
    title: 'Read the rules and start the challenge',
    detail:
      `Open the timed quiz from this page or Competitions. You must be at least ${WORLD_CUP_BALL_MIN_AGE} and a UK resident. Turn off any VPN or proxy. ${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_SHORT} on the main ${WORLD_CUP_BALL_QUESTION_COUNT} questions.`,
  },
  {
    num: 2,
    title: `Answer ${WORLD_CUP_BALL_QUESTION_COUNT} difficult questions under time pressure`,
    detail: `${WORLD_CUP_BALL_CHOICE_BONUS_NOTICE} ${WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE} Each question has a ${WORLD_CUP_BALL_QUESTION_SECONDS}-second timer. Type your answer and move on before time runs out — or tap one of four options on the bonus multiple-choice questions. If you run out of time once, you receive a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second bonus on that question only. If you run out of time a second time, you are disqualified immediately.`,
  },
  {
    num: 3,
    title: 'Win only if every answer is correct (one salvage chance)',
    detail:
      `All ${WORLD_CUP_BALL_QUESTION_COUNT} answers must be correct to win outright. If you get exactly one answer wrong, you receive one bonus salvage question — answer it correctly and you still win. Two or more wrong answers mean you do not win. There is no consolation prize and no random draw.`,
  },
  {
    num: 4,
    title: 'Complete the winner delivery form',
    detail:
      `If you win (including after one wrong answer and a successful salvage question), complete the winner delivery form with your name, email, mobile number, and UK delivery address. ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} If you are 16 or 17, also enter your parent or guardian's delivery details. We email you a confirmation with a link to return to the form if needed. If you do not win, we show which questions you missed.`,
  },
  {
    num: 5,
    title: 'Winner photo (optional refusal for valid reasons)',
    detail: WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY,
  },
]

export const WORLD_CUP_BALL_RULES_SECTIONS = [
  {
    title: 'Prize',
    body: `${WORLD_CUP_BALL_PRIZE_TITLE}. ${WORLD_CUP_BALL_PRIZE_DETAIL} ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE}`,
  },
  {
    title: 'Eligibility',
    body: WORLD_CUP_BALL_ELIGIBILITY_NOTICE,
  },
  {
    title: 'Skill requirement',
    body: WORLD_CUP_BALL_SKILL_NOTICE,
  },
  {
    title: 'Timing',
    body: WORLD_CUP_BALL_TERMS_TIMING_NOTICE,
  },
  {
    title: 'Salvage question (one wrong answer)',
    body: WORLD_CUP_BALL_TERMS_SALVAGE_NOTICE,
  },
  {
    title: 'If you do not win',
    body: WORLD_CUP_BALL_TERMS_FAIL_REVIEW_NOTICE,
  },
  {
    title: 'One attempt per connection',
    body: WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE,
  },
  {
    title: 'Winner details & delivery',
    body: `${WORLD_CUP_BALL_WINNER_DETAILS_NOTICE} ${WORLD_CUP_BALL_WINNER_EMAIL_REMINDER} Questions: ${SHOWSKILLS_CONTACT_EMAIL}.`,
  },
  {
    title: 'Winner photography',
    body: WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY,
  },
]

export function defaultWorldCupBallGiveawayPageLayout() {
  return {
    version: 1,
    badge: 'Free skill giveaway · Not signed',
    title: 'World Cup Ball Giveaway',
    intro: WORLD_CUP_BALL_RULES_INTRO,
    ctaButtonLabel: 'Start the timed quiz',
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
