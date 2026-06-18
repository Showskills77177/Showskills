import {
  WORLD_CUP_BALL_PRIZE_DETAIL,
  WORLD_CUP_BALL_PRIZE_TITLE,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_QUESTION_SECONDS,
  WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS,
  WORLD_CUP_BALL_MAX_TIMEOUTS,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS,
} from './worldCupBallGiveaway.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { WORLD_CUP_BALL_PHOTOGRAPHY_SUMMARY } from './worldCupBallPhotography.mjs'

export const WORLD_CUP_BALL_GIVEAWAY_PAGE_ID = 'world_cup_ball_giveaway'

export const WORLD_CUP_BALL_MIN_AGE = 16

export const WORLD_CUP_BALL_FREE_SHIPPING_NOTICE =
  'Prize delivery is free within the United Kingdom. We ship the official-style World Cup football to the UK postal address you provide after you win — there is no delivery charge for the winner.'

export const WORLD_CUP_BALL_ELIGIBILITY_NOTICE =
  `Open to UK residents aged ${WORLD_CUP_BALL_MIN_AGE} or over. This is a free skill challenge, not gambling or a lottery. One quiz attempt per person/device. VPNs, proxies, and similar anonymising tools are not allowed. Entrants aged 16 or 17 may take part, but prize delivery must go to a parent or legal guardian’s UK postal address with their contact details (see Winner details below).`

export const WORLD_CUP_BALL_RULES_INTRO =
  `This is a free, skill-based giveaway for one official-style FIFA World Cup football (2026 tournament design, not signed). It is separate from our paid prize draws and the Ronaldo shirt giveaway. You must answer ${WORLD_CUP_BALL_QUESTION_COUNT} difficult football questions correctly — under strict time limits — to win outright. There is no random draw: every answer must be correct, and you only get one attempt. At least ${WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS} questions are a bonus with four multiple-choice options; the rest are free-text. ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} VPNs are not permitted.`

export const WORLD_CUP_BALL_SKILL_NOTICE =
  'This promotion is a genuine skill challenge, not a lottery. Success depends on your football knowledge and speed. Minor spelling or grammar differences are accepted when the answer is clearly correct. One wrong answer, a second timeout, or use of a VPN means you do not win the ball.'

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
      `Open the timed quiz from this page or Competitions. You must be at least ${WORLD_CUP_BALL_MIN_AGE} and a UK resident. Turn off any VPN or proxy. You get exactly one attempt at all ${WORLD_CUP_BALL_QUESTION_COUNT} questions — there are no second chances.`,
  },
  {
    num: 2,
    title: `Answer ${WORLD_CUP_BALL_QUESTION_COUNT} difficult questions under time pressure`,
    detail: `${WORLD_CUP_BALL_CHOICE_BONUS_NOTICE} Each question has a ${WORLD_CUP_BALL_QUESTION_SECONDS}-second timer. Type your answer and move on before time runs out — or tap one of four options on the bonus multiple-choice questions. If you run out of time once, you receive a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second bonus on that question only. If you run out of time a second time, you are disqualified immediately.`,
  },
  {
    num: 3,
    title: 'Win only if every answer is correct',
    detail:
      `All ${WORLD_CUP_BALL_QUESTION_COUNT} answers must be correct. One incorrect answer means you do not win. There is no consolation prize and no random draw — this is a pure skill test.`,
  },
  {
    num: 4,
    title: 'Complete the winner delivery form',
    detail:
      `If — and only if — you answer all ${WORLD_CUP_BALL_QUESTION_COUNT} questions correctly, you win the ball immediately. You must then enter your name, email, mobile number, and UK delivery address on the winner form. ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} If you are 16 or 17, also enter your parent or guardian’s delivery details. We email you a confirmation with a link to return to the form if needed.`,
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
    body: `You have ${WORLD_CUP_BALL_QUESTION_SECONDS} seconds per question. The first time you exceed the limit, you receive ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS} extra seconds on that question only. A second timeout on any question disqualifies your attempt.`,
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
