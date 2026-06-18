import { formatBundlePriceGBP } from './ticketBundles.mjs'
import { minimumSalesRulesMarkdown } from './competitionMinimumSalesPolicy.mjs'

export const IPHONE_17_PRO_COMPETITION_SLUG = 'iphone_17_pro'

export const IPHONE_17_PRO_COMPETITION_LABEL = 'iPhone 17 Pro or Cash'

/** UK Apple retail — iPhone 17 Pro 256GB from £1,099 (Apple UK, 2026). */
export const IPHONE_17_PRO_RETAIL_PENCE = 109900

/** Winner may take the phone or the full retail-value cash alternative. */
export const IPHONE_17_PRO_CASH_ALTERNATIVE_PENCE = 109900

export const IPHONE_17_PRO_RETAIL_LABEL = formatBundlePriceGBP(IPHONE_17_PRO_RETAIL_PENCE)

export const IPHONE_17_PRO_PRIZE_LINE =
  'Winner chooses a brand-new iPhone 17 Pro (256GB) or the cash alternative.'

export const IPHONE_17_PRO_COMPETITION_SUMMARY =
  'Tickets from 29p. Pay online, enter free by post, or verify your card online (£0) — then answer three skill questions. All correct to qualify for the draw.'

export const IPHONE_17_PRO_RULES_MARKDOWN = `## Prize

- **Prize:** Brand-new **iPhone 17 Pro (256GB) or ${IPHONE_17_PRO_RETAIL_LABEL} in cash** — winner chooses one. UK retail from **${IPHONE_17_PRO_RETAIL_LABEL}** (phone colour subject to availability).
- One winner per competition period, drawn at random from all qualifying entries.

## How to enter

- **Paid tickets** from **${formatBundlePriceGBP(29)}** per ticket — bundle discounts available at checkout.
- **Free postal entry** — send your details and skill answers by post (same draw pool).
- **Free online entry** — £0 card verification, then answer the skill questions online.
- **One attempt** at the three skill questions per entry. All must be correct to qualify for the main draw.

## Important

${minimumSalesRulesMarkdown({ exempt: false })}

- This draw is separate from the Signed Legacy Bundle and other main prize competitions on ShowSkills Rewards.`

/** Paid bundles — entry from 29p per ticket. Amounts in pence (GBP). */
export const IPHONE_17_PRO_BUNDLES = [
  {
    id: 'single',
    qty: 1,
    totalPence: 29,
    title: 'Single',
    line1: '1 ticket = £0.29',
    line2: null,
    bullets: [],
    featured: false,
  },
  {
    id: 'starter5',
    qty: 5,
    totalPence: 140,
    title: 'Starter pack',
    line1: '5 tickets = £1.40',
    line2: '£0.28 per ticket',
    bullets: ['Quick extra entries'],
    featured: false,
  },
  {
    id: 'value10',
    qty: 10,
    totalPence: 270,
    title: 'Value bundle',
    line1: '10 tickets = £2.70',
    line2: '£0.27 per ticket',
    bullets: ['Best balance for regular entrants'],
    featured: true,
  },
  {
    id: 'plus20',
    qty: 20,
    totalPence: 520,
    title: 'Plus bundle',
    line1: '20 tickets = £5.20',
    line2: '£0.26 per ticket',
    bullets: [],
    featured: false,
  },
  {
    id: 'mega40',
    qty: 40,
    totalPence: 1000,
    title: 'Mega entries',
    line1: '40 tickets = £10',
    line2: '£0.25 per ticket',
    bullets: [],
    featured: false,
  },
  {
    id: 'max60',
    qty: 60,
    totalPence: 1500,
    title: 'Max bundle',
    line1: '£15 — 60 tickets',
    line2: '£0.25 per ticket volume rate',
    bullets: ['Most entries in one purchase'],
    featured: false,
  },
]

export const IPHONE_17_PRO_DEFAULT_BUNDLE_ID = 'single'

export const IPHONE_17_PRO_SKILL_QUESTION_SEED = [
  {
    questionKey: 'q1',
    prompt: 'What is the starting UK retail price for iPhone 17 Pro (256GB)?',
    acceptedAnswers: ['1099', '£1099', '£1,099', '1099 pounds', 'one thousand ninety nine'],
  },
  {
    questionKey: 'q2',
    prompt: 'Which Apple chip powers the iPhone 17 Pro?',
    acceptedAnswers: ['A19 Pro', 'A19Pro', 'Apple A19 Pro'],
  },
  {
    questionKey: 'q3',
    prompt: 'Name one official iPhone 17 Pro colour available in the UK.',
    acceptedAnswers: [
      'Silver',
      'Deep Blue',
      'Cosmic Orange',
      'Orange',
      'Blue',
    ],
  },
]

export function getIphone17ProBundleById(id) {
  const key = typeof id === 'string' ? id.trim() : ''
  return IPHONE_17_PRO_BUNDLES.find((b) => b.id === key) ?? null
}

export function defaultPostalNameForIphone17ProCompetition() {
  return `${IPHONE_17_PRO_COMPETITION_LABEL} — ShowSkills Rewards`
}
