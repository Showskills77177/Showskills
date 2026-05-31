import { PAID_SKILL_QUESTIONS } from './paidSkillQuestions.mjs'

export const MAX_SKILL_QUESTIONS = 10

export const LEGACY_SKILL_QUESTION_SEED = [
  {
    questionKey: 'q1',
    prompt: PAID_SKILL_QUESTIONS[0].prompt,
    acceptedAnswers: [
      'Bolton',
      'Bolton Wanderers',
      'Bolton 4-0',
      'Bolton 4 nil',
      '4-0',
      '4 nil',
      '4:0',
      'four nil',
    ],
  },
  {
    questionKey: 'q2',
    prompt: PAID_SKILL_QUESTIONS[1].prompt,
    acceptedAnswers: ['Nicky Butt', 'Nick Butt', 'Nicholas Butt', 'Butt'],
  },
  {
    questionKey: 'q3',
    prompt: PAID_SKILL_QUESTIONS[2].prompt,
    acceptedAnswers: ['47', '47th', '47th minute', 'minute 47', 'forty seven', 'forty-seven'],
  },
]

export function normalizeSkillAnswer(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function compact(value) {
  return normalizeSkillAnswer(value).replace(/\s+/g, '')
}

function editDistance(a, b) {
  const x = compact(a)
  const y = compact(b)
  if (!x || !y) return Math.max(x.length, y.length)
  const prev = Array.from({ length: y.length + 1 }, (_, i) => i)
  const curr = Array.from({ length: y.length + 1 }, () => 0)

  for (let i = 1; i <= x.length; i += 1) {
    curr[0] = i
    for (let j = 1; j <= y.length; j += 1) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= y.length; j += 1) prev[j] = curr[j]
  }
  return prev[y.length]
}

export function answerMatchesAccepted(userAnswer, acceptedList) {
  const normalized = normalizeSkillAnswer(userAnswer)
  if (!normalized) return false

  for (const raw of acceptedList || []) {
    const accepted = normalizeSkillAnswer(raw)
    if (!accepted) continue
    if (normalized === accepted) return true
    if (normalized.includes(accepted) || accepted.includes(normalized)) {
      if (accepted.length >= 2 || normalized.length >= 2) return true
    }
    if (editDistance(normalized, accepted) <= 2) return true
  }
  return false
}

/**
 * @param {Array<{ questionKey: string, prompt: string, acceptedAnswers?: string[] }>} questions
 * @param {Record<string, string>} answers
 */
export function validateCompetitionSkillAnswers(questions, answers) {
  const rows = Array.isArray(questions) ? questions : []
  const results = { allCorrect: true }

  for (const q of rows) {
    const key = q.questionKey || q.id
    const userVal = answers?.[key] ?? ''
    const ok = answerMatchesAccepted(userVal, q.acceptedAnswers || [])
    results[key] = ok
    if (!ok) results.allCorrect = false
  }

  if (!rows.length) {
    results.allCorrect = false
  }

  return results
}

export function publicSkillQuestions(questions) {
  return (questions || []).map((q, index) => ({
    id: q.questionKey || q.id || `q${index + 1}`,
    questionKey: q.questionKey || q.id || `q${index + 1}`,
    prompt: q.prompt,
    sortOrder: q.sortOrder ?? index,
  }))
}

export function normalizeSkillQuestionInput(raw, index) {
  const questionKey =
    typeof raw.questionKey === 'string' && raw.questionKey.trim()
      ? raw.questionKey.trim().slice(0, 32)
      : `q${index + 1}`
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim().slice(0, 500) : ''
  const acceptedAnswers = Array.isArray(raw.acceptedAnswers)
    ? raw.acceptedAnswers
        .map((a) => (typeof a === 'string' ? a.trim() : ''))
        .filter(Boolean)
        .slice(0, 20)
    : []
  return { questionKey, prompt, acceptedAnswers, sortOrder: index }
}
