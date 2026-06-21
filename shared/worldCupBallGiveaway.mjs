import { answerMatchesWorldCupBallAnswer } from './worldCupBallAnswerMatching.mjs'
import { WORLD_CUP_BALL_QUESTION_BANK } from './worldCupBallQuestionBank.mjs'
import {
  WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT,
  WORLD_CUP_BALL_HISTORICAL_MAX_YEAR,
  worldCupBallChoiceOptionLabel,
} from './worldCupBallHistoricalChoices.mjs'
import {
  WORLD_CUP_BALL_COMBINATION_TARGET,
  buildWorldCupBallCombinations,
  combinationCount,
  combinationHasDuplicateKeys,
  combinationHasExclusionConflict,
} from './worldCupBallQuestionCombinations.mjs'

export const WORLD_CUP_BALL_GIVEAWAY_SLUG = 'world_cup_ball_giveaway'

export const WORLD_CUP_BALL_GIVEAWAY_LABEL = 'World Cup Ball Question-Challenge Giveaway'

export const WORLD_CUP_BALL_GIVEAWAY_PATH = '/world-cup-ball-giveaway'

export const WORLD_CUP_BALL_PRIZE_TITLE = 'Official-style FIFA World Cup ball'

export const WORLD_CUP_BALL_PRIZE_DETAIL =
  'One official-style FIFA World Cup football (2026 tournament design, not signed). Awarded outright when you win the skill quiz — including via a successful salvage question after one wrong answer.'

export const WORLD_CUP_BALL_PRIZE_IMAGE_ALT =
  'Official-style FIFA World Cup ball on grass — white panel with blue 26 and Trionda branding.'

export const WORLD_CUP_BALL_QUESTION_COUNT = 10

/** @deprecated Use WORLD_CUP_BALL_QUESTION_BANK */
export const WORLD_CUP_BALL_QUESTIONS = WORLD_CUP_BALL_QUESTION_BANK

export { WORLD_CUP_BALL_QUESTION_BANK, WORLD_CUP_BALL_COMBINATION_TARGET }

/** Seconds allowed per question before a timeout. */
export const WORLD_CUP_BALL_QUESTION_SECONDS = 15

/** Extra seconds granted after the first timed-out question only. */
export const WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS = 5

/** Canonical user-facing label (hyphenated compound adjective + “time-out”). */
export const WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION = `${WORLD_CUP_BALL_QUESTION_SECONDS}-second time-out per question`

/** Shorter label for chips and timer bars. */
export const WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL = `${WORLD_CUP_BALL_QUESTION_SECONDS}-second time-out`

/** Short user-facing reminder — each question is timed. */
export const WORLD_CUP_BALL_QUESTION_TIMING_SHORT = `Each question has a ${WORLD_CUP_BALL_QUESTION_TIMEOUT_LABEL}. Miss the time-out once and you get ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS} extra seconds on that question.`

/** Full timing rules shown before the quiz and in terms. */
export const WORLD_CUP_BALL_QUESTION_TIMING_NOTICE = `${WORLD_CUP_BALL_QUESTION_TIMEOUT_PER_QUESTION}. If the time-out expires once, you receive a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second extension on that question only. A second time-out on any question ends your attempt.`

/** Short callout when the question time-out expires. */
export const WORLD_CUP_BALL_TIMEOUT_BONUS_SHORT = `Miss the time-out once? You get a one-off ${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS}-second extension on that question only.`

/** Marketing / UI highlight for the time-out extension. */
export const WORLD_CUP_BALL_TIMEOUT_BONUS_PROMINENT = `Time-out expires? +${WORLD_CUP_BALL_TIMEOUT_BONUS_SECONDS} second extension on that question — once per attempt only.`

/** Second timeout ends the attempt immediately. */
export const WORLD_CUP_BALL_MAX_TIMEOUTS = 1

/** One incorrect answer triggers a salvage bonus question instead of instant loss. */
export const WORLD_CUP_BALL_MAX_WRONG_FOR_SALVAGE = 1

export const WORLD_CUP_BALL_SALVAGE_NOTICE =
  'One incorrect answer? You receive one bonus salvage question — answer it correctly to still win the ball. A second incorrect answer ends your attempt immediately.'

/** Minimum multiple-choice (four-option) bonus questions per quiz. */
export const WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS = 2

export const WORLD_CUP_BALL_CHOICE_BONUS_NOTICE =
  `Questions about events in ${WORLD_CUP_BALL_HISTORICAL_MAX_YEAR} or earlier are multiple-choice with ${WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT} options. Newer bonus questions may offer ${worldCupBallChoiceOptionLabel(4)} — tap the correct answer instead of typing. All other questions are free-text.`

export { WORLD_CUP_BALL_HISTORICAL_MAX_YEAR, WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT } from './worldCupBallHistoricalChoices.mjs'

export const WORLD_CUP_BALL_CASE_INSENSITIVE_NOTICE =
  'Capital letters are optional — write names however you prefer (lowercase, mixed case, or ALL CAPS).'

/** Stored answer when the entrant taps “I don’t know” on a free-text question. */
export const WORLD_CUP_BALL_DONT_KNOW_ANSWER = "I don't know"

export const WORLD_CUP_BALL_DONT_KNOW_LABEL = "I don't know"

/** Shown in quiz and entry instructions before free-text questions. */
export const WORLD_CUP_BALL_ANSWER_STYLE_INSTRUCTION =
  'For free-text questions, type your answer however you wish — all lowercase (kane), normal capitals (Kane), or ALL CAPS (KANE). Capital letters are never mandatory, but they are fine if you prefer them. We mark the answer the same either way.'

/** Maximum minutes to finish once a session starts (server-side). */
export const WORLD_CUP_BALL_SESSION_MAX_MINUTES = 5

const bankByKey = new Map(WORLD_CUP_BALL_QUESTION_BANK.map((q) => [q.questionKey, q]))
const choiceQuestionKeys = new Set(
  WORLD_CUP_BALL_QUESTION_BANK.filter((q) => Array.isArray(q.choices) && q.choices.length > 0).map(
    (q) => q.questionKey,
  ),
)
const exclusionGroupByKey = new Map(
  WORLD_CUP_BALL_QUESTION_BANK.flatMap((q) =>
    q.exclusionGroup ? [[q.questionKey, q.exclusionGroup]] : [],
  ),
)
let cachedCombinations = null

export function getWorldCupBallChoiceQuestionKeys() {
  return choiceQuestionKeys
}

export function countWorldCupBallChoiceQuestions(questionKeys) {
  return (questionKeys || []).filter((key) => choiceQuestionKeys.has(key)).length
}

export function getWorldCupBallExclusionGroupByKey() {
  return exclusionGroupByKey
}

/** @param {string[]} questionKeys */
export function assertWorldCupBallQuestionKeysValid(questionKeys) {
  if (!Array.isArray(questionKeys) || questionKeys.length !== WORLD_CUP_BALL_QUESTION_COUNT) {
    throw new Error(`World Cup Ball quiz requires exactly ${WORLD_CUP_BALL_QUESTION_COUNT} questions`)
  }
  if (combinationHasDuplicateKeys(questionKeys)) {
    throw new Error('World Cup Ball quiz cannot include the same question twice')
  }
  if (combinationHasExclusionConflict(questionKeys, exclusionGroupByKey)) {
    throw new Error('World Cup Ball quiz cannot include multiple questions about the same subject')
  }
  for (const key of questionKeys) {
    if (!bankByKey.has(key)) {
      throw new Error(`Unknown World Cup Ball question key: ${key}`)
    }
  }
  if (countWorldCupBallChoiceQuestions(questionKeys) < WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS) {
    throw new Error(
      `World Cup Ball quiz requires at least ${WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS} multiple-choice bonus questions`,
    )
  }
}

export function getWorldCupBallQuestionCombinations() {
  if (!cachedCombinations) {
    const poolKeys = WORLD_CUP_BALL_QUESTION_BANK.map((q) => q.questionKey)
    cachedCombinations = buildWorldCupBallCombinations(
      poolKeys,
      WORLD_CUP_BALL_QUESTION_COUNT,
      WORLD_CUP_BALL_COMBINATION_TARGET,
      {
        exclusionGroupByKey,
        choiceKeys: choiceQuestionKeys,
        minChoiceCount: WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS,
      },
    )
    for (const combo of cachedCombinations) {
      assertWorldCupBallQuestionKeysValid(combo)
    }
  }
  return cachedCombinations
}

export function getWorldCupBallCombinationStats() {
  const poolSize = WORLD_CUP_BALL_QUESTION_BANK.length
  const maxPossible = combinationCount(poolSize, WORLD_CUP_BALL_QUESTION_COUNT)
  const combinations = getWorldCupBallQuestionCombinations()
  return {
    poolSize,
    questionsPerQuiz: WORLD_CUP_BALL_QUESTION_COUNT,
    targetCombinations: WORLD_CUP_BALL_COMBINATION_TARGET,
    maxPossibleCombinations: maxPossible,
    activeCombinations: combinations.length,
  }
}

/** Pick a random pre-generated combination for a new quiz session. */
export function pickRandomWorldCupBallCombination() {
  const combinations = getWorldCupBallQuestionCombinations()
  const combinationIndex = Math.floor(Math.random() * combinations.length)
  return {
    combinationIndex,
    questionKeys: combinations[combinationIndex],
  }
}

export function getWorldCupBallQuestionsByKeys(questionKeys) {
  return (questionKeys || [])
    .map((key) => bankByKey.get(key))
    .filter(Boolean)
}

export function parseWorldCupBallSessionQuestionKeys(session) {
  const raw = session?.question_keys_json
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

export function publicWorldCupBallQuestions(questionKeys) {
  const keys =
    questionKeys ||
    getWorldCupBallQuestionCombinations()[0] ||
    WORLD_CUP_BALL_QUESTION_BANK.slice(0, WORLD_CUP_BALL_QUESTION_COUNT).map((q) => q.questionKey)

  assertWorldCupBallQuestionKeysValid(keys)

  return getWorldCupBallQuestionsByKeys(keys).map((q, index) => {
    const row = {
      questionKey: q.questionKey,
      prompt: q.prompt,
      sortOrder: index,
    }
    if (Array.isArray(q.choices) && q.choices.length > 0) {
      row.choices = [...q.choices]
    }
    return row
  })
}

export function validateWorldCupBallAnswers(answers, questionKeys) {
  const keys =
    questionKeys ||
    getWorldCupBallQuestionCombinations()[0] ||
    WORLD_CUP_BALL_QUESTION_BANK.slice(0, WORLD_CUP_BALL_QUESTION_COUNT).map((q) => q.questionKey)

  const results = { allCorrect: true, perQuestion: {} }
  for (const key of keys) {
    const q = bankByKey.get(key)
    if (!q) {
      results.perQuestion[key] = false
      results.allCorrect = false
      continue
    }
    const userVal = answers?.[key] ?? ''
    const ok = answerMatchesWorldCupBallAnswer(userVal, q.acceptedAnswers)
    results.perQuestion[key] = ok
    if (!ok) results.allCorrect = false
  }
  return results
}

export function countWorldCupBallWrongAnswers(validation, questionKeys) {
  return (questionKeys || []).filter((key) => !validation.perQuestion[key]).length
}

/** Question keys the entrant has submitted so far (in quiz order). */
export function worldCupBallAnsweredKeys(answers, questionKeys) {
  return (questionKeys || []).filter((key) => Object.prototype.hasOwnProperty.call(answers ?? {}, key))
}

/** True when a partial attempt already has too many wrong answers to continue. */
export function shouldEndWorldCupBallQuizEarly(answers, questionKeys) {
  const answeredKeys = worldCupBallAnsweredKeys(answers, questionKeys)
  if (!answeredKeys.length || answeredKeys.length >= (questionKeys || []).length) return false
  const validation = validateWorldCupBallAnswers(answers, answeredKeys)
  const wrongCount = countWorldCupBallWrongAnswers(validation, answeredKeys)
  return wrongCount > WORLD_CUP_BALL_MAX_WRONG_FOR_SALVAGE
}

/** Pick the clearest accepted answer to show in the post-quiz review. */
export function worldCupBallReviewCorrectAnswerDisplay(question) {
  const list = Array.isArray(question?.acceptedAnswers)
    ? question.acceptedAnswers.filter((entry) => typeof entry === 'string' && entry.trim())
    : []
  if (!list.length) return ''

  if (Array.isArray(question?.choices) && question.choices.length > 0) {
    const inChoices = list.find((entry) => question.choices.includes(entry))
    if (inChoices) return inChoices
  }

  const named = list.find((entry) => !/^\d+$/.test(entry.trim()))
  return named || list[0]
}

/** @param {Record<string, string>} answers @param {string[]} questionKeys */
export function buildWorldCupBallWrongReview(answers, questionKeys) {
  const validation = validateWorldCupBallAnswers(answers, questionKeys)
  const wrong = []
  for (const key of questionKeys || []) {
    if (validation.perQuestion[key]) continue
    const q = bankByKey.get(key)
    wrong.push({
      questionKey: key,
      prompt: q?.prompt || key,
      yourAnswer: String(answers?.[key] ?? '').trim() || '(no answer)',
      correctAnswer: worldCupBallReviewCorrectAnswerDisplay(q) || '(see accepted answers)',
    })
  }
  return wrong
}

/** Pick a bonus salvage question outside the quiz set (prefers multiple-choice). */
export function pickWorldCupBallSalvageQuestion(excludedKeys) {
  const excluded = new Set(excludedKeys || [])
  const pool = WORLD_CUP_BALL_QUESTION_BANK.filter((q) => !excluded.has(q.questionKey))
  const mc = pool.filter((q) => Array.isArray(q.choices) && q.choices.length >= 4)
  const candidates = mc.length ? mc : pool
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

export function publicWorldCupBallQuestion(questionKey) {
  const q = bankByKey.get(questionKey)
  if (!q) return null
  const row = {
    questionKey: q.questionKey,
    prompt: q.prompt,
    sortOrder: 0,
  }
  if (Array.isArray(q.choices) && q.choices.length > 0) {
    row.choices = [...q.choices]
  }
  return row
}

export function isWorldCupBallDisqualifiedByTimeouts(timeoutsUsed) {
  const n = Number(timeoutsUsed)
  if (!Number.isFinite(n) || n < 0) return true
  return n > WORLD_CUP_BALL_MAX_TIMEOUTS
}
