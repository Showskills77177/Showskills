export {
  TICKET_BUNDLES,
  DEFAULT_TICKET_BUNDLE_ID,
  getTicketBundleById,
  formatBundlePriceGBP,
} from '../shared/ticketBundles.mjs'

export const BUNDLE_OFFER_ITEMS = [
  '2008 Cristiano Ronaldo signed shirt',
  'Cristiano Ronaldo Museum signed football',
  'iPhone 17 Pro Max',
  'iPhone 17 Pro Max 24K gold case',
]

export const GRAND_PRIZE_BUNDLE = {
  title: 'Ronaldo Legacy Bundle',
}

export const COMPETITION_NAME_POSTAL = 'Ronaldo Legacy Bundle — ShowSkills Rewards'

export const PAID_SKILL_QUESTIONS = [
  {
    id: 'q1',
    prompt:
      'Who did Cristiano Ronaldo make his Manchester United debut against, and what was the final score?',
  },
  {
    id: 'q2',
    prompt: 'Which player did Cristiano Ronaldo replace when he came on during his Manchester United debut?',
  },
  {
    id: 'q3',
    prompt:
      'In which minute did Cristiano Ronaldo score his first goal in his second debut vs Newcastle United in 2021?',
  },
]

function normalizeSkillAnswer(s) {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['’]/g, "'")
}

export function validatePaidSkillAnswers(a1, a2, a3) {
  const n1 = normalizeSkillAnswer(a1)
  const n2 = normalizeSkillAnswer(a2)
  const n3 = normalizeSkillAnswer(a3)

  const q1 =
    n1.includes('bolton') &&
    (/\b4\s*[-–:]\s*0\b/.test(n1) || /four\s*[- ]?nil/.test(n1) || /\b4\s+nil\b/.test(n1))
  const q2 =
    (n2.includes('nicky') && n2.includes('butt')) ||
    (n2.includes('nicholas') && n2.includes('butt'))
  const q3 =
    /\b47\b/.test(n3) || n3.includes('47th') || /forty[- ]?seven/.test(n3) || n3.includes('minute 47')

  return { allCorrect: q1 && q2 && q3, q1, q2, q3 }
}
