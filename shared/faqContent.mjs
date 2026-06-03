import { TICKET_PURCHASE_NON_REFUND_NOTICE } from './ticketCheckoutNotice.mjs'
import {
  CONSOLATION_PRIZE_FREE_APPLIES,
  CONSOLATION_PRIZE_PAID_THRESHOLD,
  CONSOLATION_PRIZE_SUMMARY,
  LEGACY_SKILL_ONE_ATTEMPT_NOTICE,
} from './consolationShirtGiveaway.mjs'
import { UK_AVAILABILITY_NOTICE } from './siteAvailability.mjs'
import { SHOWSKILLS_CONTACT_EMAIL } from './siteContact.mjs'
import { COMPETITION_NAME_POSTAL, POSTAL_ENTRY_ADDRESS, NO_PURCHASE_ENTRY_NOTICE } from './competitionCopy.mjs'
import { SHIRT_GIVEAWAY_SEASON_LABEL } from './shirtGiveaway.mjs'
import {
  buildShirtGiveawayFaqBlockedAnswer,
  buildShirtGiveawayFaqRequirementsAnswer,
} from './shirtGiveawayEntryRequirements.mjs'

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
          'ShowSkills Rewards is a UK skill-based rewards site. Our headline promotion is the Ronaldo Legacy Bundle draw: signed memorabilia, a museum football, and iPhone prizes for one winner. You enter with paid tickets or a free postal route, answer three Ronaldo skill questions, and — if every answer is correct — your ticket numbers join a random draw. We also run a separate free Ronaldo signed shirt giveaway.',
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
          'No. The Ronaldo Legacy Bundle draw is a skill competition, not a lottery. You must answer three free-text skill questions correctly to qualify for the main draw. Among everyone who qualified in that competition period, one winner is chosen at random. ' +
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
          'No. ShowSkills Rewards is not affiliated with Cristiano Ronaldo, any football club, or brands shown in prize imagery. Prizes are described on our website and in the terms.',
      },
    ],
  },
  {
    id: 'legacy-bundle',
    title: 'Ronaldo Legacy Bundle rewards',
    summary: 'Paid tickets, free postal entry, and how your answers qualify you for the draw.',
    items: [
      {
        id: 'no-purchase-necessary',
        question: 'Do I have to pay to enter the Legacy Bundle draw?',
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
          'Open the Legacy Bundle entry from Competitions or the home page. Choose a ticket bundle, enter your name, email, and mobile number, agree to the terms, and pay by debit or credit card (Apple Pay or Google Pay when shown on your device). After payment succeeds, complete all three skill questions in the same session. Every answer must be correct for your tickets to count in the draw.',
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
          `${NO_PURCHASE_ENTRY_NOTICE} You may enter the same Legacy Bundle draw without payment by post. Send your full name, full postal address, email, and the competition name (${COMPETITION_NAME_POSTAL}), plus written answers to all three skill questions, to: ${POSTAL_ENTRY_ADDRESS}. Limit: one free postal entry per person. Postal entries have the same chance to qualify as paid entries if answers are correct.`,
        popular: true,
      },
      {
        id: 'free-online-entry',
        question: 'How does free online entry work (no payment)?',
        answer:
          `${NO_PURCHASE_ENTRY_NOTICE} Where offered on the Legacy Bundle entry form, choose the free online route: complete £0 debit card verification (you are not charged), then answer the three skill questions in the same session. Card details are entered only in our payment provider’s secure fields — ShowSkills Rewards does not collect or store your debit card details from free entry. Entry limits (e.g. per name and address) are shown on the form.`,
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
        id: 'refunds',
        question: 'Can I get a refund on tickets?',
        answer: TICKET_PURCHASE_NON_REFUND_NOTICE,
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
          'For a given paid purchase or free online Legacy Bundle entry, you have one attempt at the three skill questions. If your answers are wrong, that entry does not qualify for the main draw and tickets are not refunded. ' +
          CONSOLATION_PRIZE_SUMMARY +
          ' ' +
          CONSOLATION_PRIZE_PAID_THRESHOLD +
          ' ' +
          CONSOLATION_PRIZE_FREE_APPLIES +
          ' Buying another ticket bundle starts a new paid entry (subject to our rules and limits). Free postal and free online Legacy Bundle routes have their own limits — see the Legacy Bundle section above.',
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
    summary:
      `Separate free promotion for a signed ${SHIRT_GIVEAWAY_SEASON_LABEL} Manchester United shirt — skill question, newsletter, and social follow required.`,
    items: [
      {
        id: 'shirt-separate',
        question: 'Is the shirt giveaway the same as the Legacy Bundle draw?',
        answer:
          `No. The shirt giveaway is a separate free promotion. The prize is a signed Cristiano Ronaldo Manchester United home shirt from the ${SHIRT_GIVEAWAY_SEASON_LABEL} only — not the full Legacy Bundle (2008 signed shirt, museum ball, iPhone, and case). Entering the shirt giveaway does not automatically enter you into the paid bundle draw unless we state otherwise on the site.`,
      },
      {
        id: 'shirt-requirements',
        question: 'What must I complete to enter the free shirt giveaway?',
        answer: buildShirtGiveawayFaqRequirementsAnswer(),
        popular: true,
      },
      {
        id: 'shirt-how',
        question: 'Where do I enter the shirt giveaway?',
        answer:
          'Open the free entry form from the Competitions page (free giveaways section) or go directly to the dedicated Ronaldo shirt giveaway page at /archive/ronaldo-shirt-giveaway. The form walks you through every requirement: skill question, your contact details, newsletter signup, social follow with username, and terms consent. See “What must I complete to enter the free shirt giveaway?” above for the full checklist.',
      },
      {
        id: 'shirt-newsletter',
        question: 'Why do I have to subscribe to the newsletter?',
        answer:
          'Newsletter signup is a required condition for every free shirt giveaway entry. Tick the box on the form using the same email address you enter — we use it to send giveaway updates and to verify that you opted in. You can manage preferences or unsubscribe later via the link in any email we send.',
      },
      {
        id: 'shirt-social',
        question: 'Why do I need to follow ShowSkills on social media?',
        answer:
          'Following us on TikTok, Instagram, or Facebook (your choice — at least one) is part of the free entry conditions. Select the network in the form, follow our profile, enter your username on that network, and tick to confirm you have followed us so we can verify engagement. This is separate from the Legacy Bundle paid draw.',
      },
      {
        id: 'shirt-limits',
        question: 'Why was my shirt entry blocked?',
        answer: buildShirtGiveawayFaqBlockedAnswer(),
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
        question: 'What rewards can I win in the Legacy Bundle draw?',
        answer:
          'The Ronaldo Legacy Bundle prize stack includes a 2008 Cristiano Ronaldo signed shirt, a Cristiano Ronaldo Museum signed football, an iPhone 17 Pro Max (512GB, unlocked), and a 24K gold-style case for the phone. Exact specifications and substitution rules (for example phone colour) are listed on the home page and in the full terms.',
      },
      {
        id: 'winner-contact',
        question: 'How will I know if I won?',
        answer:
          'We email the winner at the address on their entry and may call the mobile number they provided. Winners should reply within 14 days as stated in the winner email. We may ask for proof of identity and eligibility before releasing a prize.',
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
