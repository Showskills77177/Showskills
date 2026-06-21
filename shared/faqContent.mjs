import { TICKET_PURCHASE_NON_REFUND_NOTICE } from './ticketCheckoutNotice.mjs'
import {
  minimumSalesThresholdFaqAnswer,
  ticketRefundsFaqAnswer,
} from './competitionMinimumSalesPolicy.mjs'
import {
  CONSOLATION_PRIZE_FREE_APPLIES,
  CONSOLATION_PRIZE_PAID_THRESHOLD,
  CONSOLATION_PRIZE_SUMMARY,
  LEGACY_SKILL_ONE_ATTEMPT_NOTICE,
} from './consolationShirtGiveaway.mjs'
import { UK_AVAILABILITY_NOTICE } from './siteAvailability.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { COMPETITION_NAME_POSTAL, POSTAL_ENTRY_ADDRESS, NO_PURCHASE_ENTRY_NOTICE } from './competitionCopy.mjs'
import { SHIRT_GIVEAWAY_SEASON, SHIRT_GIVEAWAY_SEASON_LABEL } from './shirtGiveaway.mjs'
import { PRIZE_AUTHENTICITY_FAQ_ANSWER } from './prizeAuthenticityCopy.mjs'
import { winnerPhotographyConsentFaqAnswer } from './winnerPhotographyConsent.mjs'
import {
  WORLD_CUP_BALL_GIVEAWAY_LABEL,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_CHOICE_BONUS_NOTICE,
  WORLD_CUP_BALL_ANSWER_STYLE_INSTRUCTION,
  WORLD_CUP_BALL_SALVAGE_NOTICE,
  WORLD_CUP_BALL_QUESTION_TIMING_NOTICE,
} from './worldCupBallGiveaway.mjs'
import {
  WORLD_CUP_BALL_ELIGIBILITY_NOTICE,
  WORLD_CUP_BALL_FREE_SHIPPING_NOTICE,
  WORLD_CUP_BALL_WINNER_EMAIL_REMINDER,
  WORLD_CUP_BALL_TERMS_SALVAGE_NOTICE,
  WORLD_CUP_BALL_TERMS_FAIL_REVIEW_NOTICE,
  WORLD_CUP_BALL_TERMS_WIN_NOTICE,
  WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE,
} from './worldCupBallGiveawayRules.mjs'
import { WORLD_CUP_BALL_MONTHLY_DRAW_SUMMARY } from './worldCupBallMonthlyDraw.mjs'
import { worldCupBallPhotographyFaqAnswer } from './worldCupBallPhotography.mjs'

/** @typedef {{ id: string, question: string, answer: string, popular?: boolean }} FaqItem */
/** @typedef {{ id: string, title: string, summary: string, items: FaqItem[] }} FaqSection */

export const FAQ_PAGE_TITLE = 'Frequently asked questions'

export const FAQ_PAGE_SUBTITLE =
  'Everything you need to know about ShowSkills Rewards — entering competitions, skill quizzes, tickets, prizes, and what happens when someone wins.'

/** Shown at the top of the FAQ page — quick picks. */
export const FAQ_POPULAR_IDS = [
  'no-purchase-necessary',
  'how-to-enter-paid',
  'free-postal',
  'free-online-entry',
  'how-winner-chosen',
  'when-quiz',
  'consolation-prize',
  'prize-authenticity',
  'minimum-ticket-sales',
  'refunds',
]

/** @type {FaqSection[]} */
export const FAQ_SECTIONS = [
  {
    id: 'general',
    title: 'About ShowSkills Rewards',
    summary: 'What we run, who can enter, and how skill-based draws work.',
    items: [
      {
        id: 'what-is-showskills',
        question: 'What is ShowSkills Rewards?',
        answer:
          'ShowSkills Rewards is a UK skill-based rewards site. Our headline promotion is the Signed Legacy Bundle draw: signed memorabilia, a museum football, and iPhone prizes for one winner. You enter with paid tickets or a free postal route, answer three Ronaldo skill questions, and — if every answer is correct — your ticket numbers join a random draw. We also run a separate free Ronaldo signed shirt giveaway.',
        popular: true,
      },
      {
        id: 'who-can-enter',
        question: 'Who can enter?',
        answer:
          'You must be 18 or over and a UK resident. ' + UK_AVAILABILITY_NOTICE,
      },
      {
        id: 'lottery-or-skill',
        question: 'Is this a lottery?',
        answer:
          'No. The Signed Legacy Bundle draw is a skill competition, not a lottery. You must answer three free-text skill questions correctly to qualify for the main draw. Among everyone who qualified in that competition period, one winner is chosen at random. ' +
          NO_PURCHASE_ENTRY_NOTICE +
          ' ' +
          LEGACY_SKILL_ONE_ATTEMPT_NOTICE +
          ' ' +
          CONSOLATION_PRIZE_SUMMARY +
          ' ' +
          CONSOLATION_PRIZE_PAID_THRESHOLD +
          ' ' +
          CONSOLATION_PRIZE_FREE_APPLIES,
      },
      {
        id: 'affiliation',
        question: 'Are you affiliated with Cristiano Ronaldo or any club?',
        answer:
          'No. ShowSkills Rewards is not affiliated with Cristiano Ronaldo, CR7, Manchester United Football Club, or Apple Inc. Prizes are independently acquired rare collectibles — see our Prize authenticity FAQ and the Terms & Privacy Policy for full detail.',
      },
      {
        id: 'prize-authenticity',
        question: 'Are the prizes genuine? How do you verify authenticity?',
        answer: PRIZE_AUTHENTICITY_FAQ_ANSWER,
        popular: true,
      },
    ],
  },
  {
    id: 'legacy-bundle',
    title: 'Signed Legacy Bundle rewards',
    summary: 'Paid tickets, free postal entry, and how your answers qualify you for the draw.',
    items: [
      {
        id: 'no-purchase-necessary',
        question: 'Do I have to pay to enter the Signed Legacy Bundle draw?',
        answer:
          NO_PURCHASE_ENTRY_NOTICE +
          ' Postal address: ' +
          POSTAL_ENTRY_ADDRESS +
          '. You still must answer all skill questions correctly to qualify for the main draw, whether you enter by post, free online verification, or paid tickets.',
        popular: true,
      },
      {
        id: 'how-to-enter-paid',
        question: 'How do I enter with paid tickets?',
        answer:
          'Open the Signed Legacy Bundle entry from Competitions or the home page. Choose a ticket bundle, enter your name, email, and mobile number, agree to the terms, and pay by debit or credit card (Apple Pay or Google Pay when shown on your device). After payment succeeds, complete all three skill questions in the same session. Every answer must be correct for your tickets to count in the draw.',
        popular: true,
      },
      {
        id: 'ticket-bundles',
        question: 'What ticket bundles are available?',
        answer:
          'Bundles range from a single ticket (75p) up to larger packs (for example 5, 10, 20, 40, or 63 tickets at the £25 mega rate). Each ticket number is one chance in the weighted draw — more tickets mean higher odds, but only if your skill answers are all correct.',
      },
      {
        id: 'when-quiz',
        question: 'When do I answer the skill questions?',
        answer:
          'For paid entry, immediately after payment. If you leave before finishing, check your confirmation email for a link to resume the quiz while it is still available. Unfinished quizzes do not qualify for the draw.',
        popular: true,
      },
      {
        id: 'free-postal',
        question: 'How does free postal entry work?',
        answer:
          `${NO_PURCHASE_ENTRY_NOTICE} You may enter the same Signed Legacy Bundle draw without payment by post. Send your full name, full postal address, email, and the competition name (${COMPETITION_NAME_POSTAL}), plus written answers to all three skill questions, to: ${POSTAL_ENTRY_ADDRESS}. Limit: one free postal entry per person. Postal entries have the same chance to qualify as paid entries if answers are correct.`,
        popular: true,
      },
      {
        id: 'free-online-entry',
        question: 'How does free online entry work (no payment)?',
        answer:
          `${NO_PURCHASE_ENTRY_NOTICE} Where offered on the Signed Legacy Bundle entry form, choose the free online route: complete £0 debit card verification (you are not charged), then answer the three skill questions in the same session. Card details are entered only in our payment provider’s secure fields — ShowSkills Rewards does not collect or store your debit card details from free entry. Entry limits (e.g. per name and address) are shown on the form.`,
        popular: true,
      },
      {
        id: 'competition-periods',
        question: 'What is a competition period?',
        answer:
          'Each draw runs for a defined entry window (a competition period). Only entries made during that period are included when the period is closed and the draw is run. Entries from other periods are not mixed together. Dates are managed by the promoter and shown in our terms.',
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payments & tickets',
    summary: 'Secure card checkout, receipts, and what to do if something goes wrong.',
    items: [
      {
        id: 'payment-methods',
        question: 'Which payment methods do you accept?',
        answer:
          'Paid tickets can be bought with debit or credit card on our secure checkout page. Card details are entered in encrypted fields and are not stored on our servers. When enabled, you may also see Apple Pay in Safari or Google Pay on supported Android phones in Chrome. Your bank may ask you to complete 3D Secure (app or SMS). Samsung Pay is not available on our checkout — many Samsung users can pay with Google Pay in Chrome instead.',
      },
      {
        id: 'payment-failed',
        question: 'My payment failed or was declined — what should I do?',
        answer:
          'Try another card, ensure you are in the UK, and turn off VPNs. Check with your bank that online payments are allowed. If you were charged but did not get tickets or a quiz link, email us at ' +
          SHOWSKILLS_CONTACT_EMAIL +
          ' with the time of purchase and the email you used.',
      },
      {
        id: 'charged-no-tickets',
        question: 'I was charged but did not receive ticket numbers or the quiz',
        answer:
          'Wait a few minutes and check your email (including spam) for a confirmation with ticket numbers and a quiz link. If nothing arrives after 30 minutes, contact us at ' +
          SHOWSKILLS_CONTACT_EMAIL +
          ' with your email, approximate purchase time, and payment reference if you have one (from your bank or card statement).',
      },
      {
        id: 'minimum-ticket-sales',
        question: 'What happens if not enough tickets are sold?',
        answer: minimumSalesThresholdFaqAnswer(),
        popular: true,
      },
      {
        id: 'refunds',
        question: 'Can I get a refund on tickets?',
        answer: ticketRefundsFaqAnswer(),
        popular: true,
      },
      {
        id: 'non-uk-payment',
        question: 'Can I pay from outside the UK?',
        answer: UK_AVAILABILITY_NOTICE,
      },
    ],
  },
  {
    id: 'quiz',
    title: 'Skill quiz',
    summary: 'Three Ronaldo questions — format, retries, and resuming after payment.',
    items: [
      {
        id: 'quiz-format',
        question: 'What format are the questions?',
        answer:
          'Three free-text questions about Cristiano Ronaldo — you type answers manually (no multiple choice). They are graded against fixed correct answers. All three must be correct to qualify.',
      },
      {
        id: 'quiz-wrong',
        question: 'I got a question wrong — can I try again?',
        answer:
          'For a given paid purchase or free online Signed Legacy Bundle entry, you have one attempt at the three skill questions. If your answers are wrong, that entry does not qualify for the main draw and tickets are not refunded. ' +
          CONSOLATION_PRIZE_SUMMARY +
          ' ' +
          CONSOLATION_PRIZE_PAID_THRESHOLD +
          ' ' +
          CONSOLATION_PRIZE_FREE_APPLIES +
          ' Buying another ticket bundle starts a new paid entry (subject to our rules and limits). Free postal and free online Signed Legacy Bundle routes have their own limits — see the Signed Legacy Bundle section above.',
      },
      {
        id: 'consolation-prize',
        question: 'What is the consolation prize if I get the skill questions wrong?',
        answer:
          CONSOLATION_PRIZE_SUMMARY +
          ' ' +
          CONSOLATION_PRIZE_PAID_THRESHOLD +
          ' ' +
          CONSOLATION_PRIZE_FREE_APPLIES +
          ' Consolation entries are added automatically — you do not need to fill in the separate shirt giveaway form again. ' +
          TICKET_PURCHASE_NON_REFUND_NOTICE,
        popular: true,
      },
      {
        id: 'quiz-resume',
        question: 'I closed the page before finishing the quiz',
        answer:
          'Use the link in your purchase confirmation email to resume. Complete all three questions while the link is valid. If the link expired or does not work, contact ' +
          SHOWSKILLS_CONTACT_EMAIL +
          ' with your order reference.',
      },
    ],
  },
  {
    id: 'shirt-giveaway',
    title: 'Free Ronaldo shirt giveaway',
    summary: 'A separate free promotion — not the same draw as the Signed Legacy Bundle.',
    items: [
      {
        id: 'shirt-separate',
        question: 'Is the shirt giveaway the same as the Signed Legacy Bundle draw?',
        answer:
          `No. The shirt giveaway is a separate free promotion. The prize is a signed Cristiano Ronaldo Manchester United home shirt from the ${SHIRT_GIVEAWAY_SEASON_LABEL} only — not the full Signed Legacy Bundle. Entering the shirt giveaway does not automatically enter you into the paid bundle draw unless we state otherwise on the site.`,
      },
      {
        id: 'shirt-how',
        question: 'How do I enter the shirt giveaway?',
        answer:
          `From Competitions or the dedicated Ronaldo shirt giveaway page, open the free entry form. Enter your full name, email, and mobile number. Answer the skill question correctly, subscribe to our newsletter (same email — tick the box), and follow ShowSkills on at least one of TikTok, Instagram, or Facebook — enter your username on that network and confirm you have followed us. Agree to the terms and submit. If everything is correct, you are entered into the random draw for the signed ${SHIRT_GIVEAWAY_SEASON} shirt. No payment or video upload is required.`,
      },
      {
        id: 'shirt-limits',
        question: 'Why was my shirt entry blocked?',
        answer:
          'Common reasons: you already entered on this device (one entry per device), duplicate name or email, VPN or proxy detected (turn off your VPN and try again), or an incorrect qualification answer. The site will show a short message when an entry is blocked.',
      },
    ],
  },
  {
    id: 'winners',
    title: 'Draws, winners & prizes',
    summary: 'How winners are picked, notified, and what the rewards include.',
    items: [
      {
        id: 'how-winner-chosen',
        question: 'How is the winner chosen?',
        answer:
          'After a competition period closes, we draw at random from all qualified ticket numbers in that period only. Each qualified ticket is one chance; buying more tickets increases your odds only if all your skill answers were correct.',
        popular: true,
      },
      {
        id: 'what-prizes',
        question: 'What rewards can I win in the Signed Legacy Bundle draw?',
        answer:
          'The Signed Legacy Bundle prize stack includes a certified 2008 Ronaldo signed shirt, a certified Ronaldo museum signed football, an iPhone 17 Pro Max (512GB, unlocked), and a 24K gold-style case for the phone. Exact specifications and substitution rules (for example phone colour) are listed on the home page and in the full terms. For how we source and verify items, see the Prize authenticity section in our FAQs.',
      },
      {
        id: 'winner-contact',
        question: 'How will I know if I won?',
        answer:
          'We email the winner at the address on their entry and may call the mobile number they provided. Winners should reply within 14 days as stated in the winner email. We may ask for proof of identity and eligibility before releasing a prize.',
      },
      {
        id: 'winner-photography-consent',
        question: 'If I win, do I have to be photographed or filmed with the prize?',
        answer: winnerPhotographyConsentFaqAnswer(),
      },
      {
        id: 'phone-why',
        question: 'Why do you ask for my phone number?',
        answer:
          'So we can contact you quickly if you win or if we need to verify an entry. We use it only for competition administration and prize fulfilment, and delete it after the relevant competition period ends unless the law or a dispute requires us to keep it longer. See our Terms and Privacy Policy for full detail.',
      },
      {
        id: 'not-winner',
        question: 'I did not win — will there be another draw?',
        answer:
          'New competition periods may open on the website. Follow our competitions page or check back later. Past periods that have already been drawn will not be re-run.',
      },
    ],
  },
  {
    id: 'world-cup-ball',
    title: WORLD_CUP_BALL_GIVEAWAY_LABEL,
    summary: `Free skill challenge — win the World Cup ball by answering ${WORLD_CUP_BALL_QUESTION_COUNT} timed questions correctly, or one wrong with a successful salvage question.`,
    items: [
      {
        id: 'wc-ball-what',
        question: `What is the ${WORLD_CUP_BALL_GIVEAWAY_LABEL}?`,
        answer:
          `A free skill-based promotion for one official-style FIFA World Cup ball (not signed). Answer all ${WORLD_CUP_BALL_QUESTION_COUNT} difficult football questions correctly within strict time limits to win outright, or get exactly one wrong and answer a bonus salvage question correctly. ${WORLD_CUP_BALL_CHOICE_BONUS_NOTICE} ${WORLD_CUP_BALL_MONTHLY_DRAW_SUMMARY} No payment is required.`,
      },
      {
        id: 'wc-ball-how-win',
        question: 'How do I win the ball?',
        answer:
          `Answer all ${WORLD_CUP_BALL_QUESTION_COUNT} main questions correctly to win outright, or answer exactly one incorrectly and then answer the bonus salvage question correctly. ${WORLD_CUP_BALL_QUESTION_TIMING_NOTICE} ${WORLD_CUP_BALL_SALVAGE_NOTICE} ${WORLD_CUP_BALL_TERMS_FAIL_REVIEW_NOTICE}`,
      },
      {
        id: 'wc-ball-monthly-draw',
        question: 'What happens if I fail the skill quiz?',
        answer: WORLD_CUP_BALL_MONTHLY_DRAW_SUMMARY,
      },
      {
        id: 'wc-ball-capitals',
        question: 'Do capital letters matter in my answers?',
        answer: WORLD_CUP_BALL_ANSWER_STYLE_INSTRUCTION,
      },
      {
        id: 'wc-ball-details',
        question: 'When do I enter my name, phone, and address?',
        answer:
          `${WORLD_CUP_BALL_TERMS_WIN_NOTICE} ${WORLD_CUP_BALL_FREE_SHIPPING_NOTICE} ${WORLD_CUP_BALL_WINNER_EMAIL_REMINDER}`,
      },
      {
        id: 'wc-ball-eligibility',
        question: 'Who can enter?',
        answer: WORLD_CUP_BALL_ELIGIBILITY_NOTICE,
      },
      {
        id: 'wc-ball-photo',
        question: 'Do I have to be photographed with the ball?',
        answer: worldCupBallPhotographyFaqAnswer(),
      },
      {
        id: 'wc-ball-connection',
        question: 'Can I try on my phone and my computer?',
        answer: WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE,
      },
      {
        id: 'wc-ball-attempts',
        question: 'Can I try again if I fail?',
        answer:
          `${WORLD_CUP_BALL_ONE_ATTEMPT_PER_CONNECTION_NOTICE} ${WORLD_CUP_BALL_TERMS_SALVAGE_NOTICE} Two or more wrong answers, a failed salvage answer, a second timeout, or VPN use ends your attempt under the published rules.`,
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical issues',
    summary: 'VPN blocks, checkout browsers, and missing emails.',
    items: [
      {
        id: 'vpn',
        question: 'The site says VPNs are not allowed',
        answer:
          'The shirt giveaway blocks many VPN and proxy connections. Turn off your VPN, use a normal UK home or mobile connection, refresh the page, and try again.',
      },
      {
        id: 'cookies-safari',
        question: 'Checkout will not load (Safari, Brave, or mobile)',
        answer:
          'Allow cookies and cross-site content for showskills.co.uk, disable strict tracking prevention for the payment step, or try Chrome. Complete card payment in the same browser session you started in.',
      },
      {
        id: 'email-missing',
        question: 'I am not receiving emails from you',
        answer:
          'Check spam, promotions, and blocked folders. Add ' +
          SHOWSKILLS_CONTACT_EMAIL +
          ' to your contacts. If you use a work or school email filter, try a personal address. Contact us if confirmations or winner emails still do not arrive.',
      },
      {
        id: 'contact-help',
        question: 'I still need help',
        answer:
          'Use our contact form or email ' +
          SHOWSKILLS_CONTACT_EMAIL +
          '. For payment issues, include your order reference, email, and purchase time. We aim to reply as soon as we can.',
      },
    ],
  },
]

/** Flat list for search and popular picks. */
export function flattenFaqItems(sections = FAQ_SECTIONS) {
  return sections.flatMap((section) =>
    section.items.map((item) => ({
      ...item,
      sectionId: section.id,
      sectionTitle: section.title,
    })),
  )
}

export function getPopularFaqItems(sections = FAQ_SECTIONS) {
  const flat = flattenFaqItems(sections)
  return FAQ_POPULAR_IDS.map((id) => flat.find((item) => item.id === id)).filter(Boolean)
}

export function filterFaqSections(sections, query) {
  const q = query.trim().toLowerCase()
  if (!q) return sections
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.question.toLowerCase().includes(q) ||
          item.answer.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q) ||
          section.summary.toLowerCase().includes(q),
      ),
    }))
    .filter((section) => section.items.length > 0)
}
