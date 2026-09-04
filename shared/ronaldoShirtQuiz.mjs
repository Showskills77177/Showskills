/**
 * Ronaldo Shirt Giveaway skill quiz — a 25-question timed test that replaces the
 * old single-question qualifier for the free Ronaldo shirt giveaway.
 *
 * Reuses the same question pool, combination builder, and answer matcher as the
 * World Cup Ball giveaway (they are already generic, not tied to any one prize),
 * and adds Ronaldo-specific rules:
 *  - 25 base questions per attempt.
 *  - Up to 2 wrong answers are tolerated; each one grants one extra "salvage"
 *    question. A 3rd wrong answer (anywhere, including on a salvage question)
 *    ends the attempt.
 *  - Up to 2 question time-outs each grant a one-off +5 second extension on that
 *    question; a 3rd time-out ends the attempt.
 *
 * Winning the quiz does not by itself enter you into the giveaway draw — it
 * unlocks a short-lived pass token that must still be redeemed via the existing
 * free-entry form (name, email, phone, newsletter, social follow) before an
 * entry is recorded, exactly as before.
 */
import { WORLD_CUP_BALL_QUESTION_BANK } from './worldCupBallQuestionBank.mjs'
import {
  buildWorldCupBallCombinations,
  combinationCount,
  combinationHasDuplicateKeys,
  combinationHasExclusionConflict,
} from './worldCupBallQuestionCombinations.mjs'
import {
  getWorldCupBallQuestionsByKeys,
  publicWorldCupBallQuestion,
  validateWorldCupBallAnswers,
  countWorldCupBallWrongAnswers,
  worldCupBallAnsweredKeys,
  buildWorldCupBallWrongReview,
  pickWorldCupBallSalvageQuestion,
} from './worldCupBallGiveaway.mjs'
import { worldCupBallChoiceOptionLabel } from './worldCupBallHistoricalChoices.mjs'

export const RONALDO_SHIRT_QUIZ_SLUG = 'ronaldo_shirt_quiz'

export const RONALDO_SHIRT_QUIZ_LABEL = 'Ronaldo Shirt Giveaway Skill Quiz'

/** Base questions served per attempt (before any mistake-salvage extras). */
export const RONALDO_SHIRT_QUIZ_QUESTION_COUNT = 25

/** Seconds allowed per question before a timeout. */
export const RONALDO_SHIRT_QUIZ_QUESTION_SECONDS = 15

/** Extra seconds granted on each of the first two timed-out questions. */
export const RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS = 5

/** A 3rd time-out ends the attempt — the first two each grant the bonus above. */
export const RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS = 2

/** Canonical user-facing label. */
export const RONALDO_SHIRT_QUIZ_QUESTION_TIMEOUT_LABEL = `${RONALDO_SHIRT_QUIZ_QUESTION_SECONDS}-second time-out`

export const RONALDO_SHIRT_QUIZ_QUESTION_TIMING_NOTICE = `${RONALDO_SHIRT_QUIZ_QUESTION_SECONDS}-second time-out per question. If a time-out expires, you get a one-off ${RONALDO_SHIRT_QUIZ_TIMEOUT_BONUS_SECONDS}-second extension on that question — this can happen twice per attempt. A third time-out ends your attempt.`

/** Up to 2 wrong answers are tolerated; each grants one extra salvage question. */
export const RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE = 2

export const RONALDO_SHIRT_QUIZ_SALVAGE_NOTICE =
  'Make a mistake and you get one extra bonus question to salvage it — this can happen twice per attempt. A third mistake ends your attempt immediately.'

/** Minimum multiple-choice (four-option) bonus questions per quiz. */
export const RONALDO_SHIRT_QUIZ_MIN_CHOICE_QUESTIONS = 5

export const RONALDO_SHIRT_QUIZ_CHOICE_BONUS_NOTICE = `Some bonus questions offer ${worldCupBallChoiceOptionLabel(4)} — tap the correct answer instead of typing. All other questions are free-text.`

export const RONALDO_SHIRT_QUIZ_CASE_INSENSITIVE_NOTICE =
  'Capital letters are optional — write names however you prefer (lowercase, mixed case, or ALL CAPS).'

export const RONALDO_SHIRT_QUIZ_DONT_KNOW_ANSWER = "I don't know"
export const RONALDO_SHIRT_QUIZ_DONT_KNOW_LABEL = "I don't know"

/** Target number of unique question sets served across quiz attempts. */
export const RONALDO_SHIRT_QUIZ_COMBINATION_TARGET = 200

/** Maximum minutes to finish once a session starts (server-side). Generous for 25+2 questions. */
export const RONALDO_SHIRT_QUIZ_SESSION_MAX_MINUTES = 15

/** How long a "won" pass token stays redeemable on the giveaway entry form. */
export const RONALDO_SHIRT_QUIZ_PASS_TOKEN_GRACE_MINUTES = 30

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

export function getRonaldoShirtQuizChoiceQuestionKeys() {
  return choiceQuestionKeys
}

export function countRonaldoShirtQuizChoiceQuestions(questionKeys) {
  return (questionKeys || []).filter((key) => choiceQuestionKeys.has(key)).length
}

/** @param {string[]} questionKeys */
export function assertRonaldoShirtQuizQuestionKeysValid(questionKeys) {
  if (!Array.isArray(questionKeys) || questionKeys.length !== RONALDO_SHIRT_QUIZ_QUESTION_COUNT) {
    throw new Error(`Ronaldo shirt quiz requires exactly ${RONALDO_SHIRT_QUIZ_QUESTION_COUNT} questions`)
  }
  if (combinationHasDuplicateKeys(questionKeys)) {
    throw new Error('Ronaldo shirt quiz cannot include the same question twice')
  }
  if (combinationHasExclusionConflict(questionKeys, exclusionGroupByKey)) {
    throw new Error('Ronaldo shirt quiz cannot include multiple questions about the same subject')
  }
  for (const key of questionKeys) {
    if (!bankByKey.has(key)) {
      throw new Error(`Unknown Ronaldo shirt quiz question key: ${key}`)
    }
  }
  if (countRonaldoShirtQuizChoiceQuestions(questionKeys) < RONALDO_SHIRT_QUIZ_MIN_CHOICE_QUESTIONS) {
    throw new Error(
      `Ronaldo shirt quiz requires at least ${RONALDO_SHIRT_QUIZ_MIN_CHOICE_QUESTIONS} multiple-choice bonus questions`,
    )
  }
}

export function getRonaldoShirtQuizCombinations() {
  if (!cachedCombinations) {
    const poolKeys = WORLD_CUP_BALL_QUESTION_BANK.map((q) => q.questionKey)
    cachedCombinations = buildWorldCupBallCombinations(
      poolKeys,
      RONALDO_SHIRT_QUIZ_QUESTION_COUNT,
      RONALDO_SHIRT_QUIZ_COMBINATION_TARGET,
      {
        exclusionGroupByKey,
        choiceKeys: choiceQuestionKeys,
        minChoiceCount: RONALDO_SHIRT_QUIZ_MIN_CHOICE_QUESTIONS,
      },
    )
    for (const combo of cachedCombinations) {
      assertRonaldoShirtQuizQuestionKeysValid(combo)
    }
  }
  return cachedCombinations
}

export function getRonaldoShirtQuizCombinationStats() {
  const poolSize = WORLD_CUP_BALL_QUESTION_BANK.length
  const maxPossible = combinationCount(poolSize, RONALDO_SHIRT_QUIZ_QUESTION_COUNT)
  const combinations = getRonaldoShirtQuizCombinations()
  return {
    poolSize,
    questionsPerQuiz: RONALDO_SHIRT_QUIZ_QUESTION_COUNT,
    targetCombinations: RONALDO_SHIRT_QUIZ_COMBINATION_TARGET,
    maxPossibleCombinations: maxPossible,
    activeCombinations: combinations.length,
  }
}

/** Pick a random pre-generated combination for a new quiz session. */
export function pickRandomRonaldoShirtQuizCombination() {
  const combinations = getRonaldoShirtQuizCombinations()
  const combinationIndex = Math.floor(Math.random() * combinations.length)
  return {
    combinationIndex,
    questionKeys: combinations[combinationIndex],
  }
}

export function getRonaldoShirtQuizQuestionsByKeys(questionKeys) {
  return getWorldCupBallQuestionsByKeys(questionKeys)
}

export function parseRonaldoShirtQuizSessionQuestionKeys(session) {
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

export function parseRonaldoShirtQuizSalvageKeys(session) {
  const raw = session?.salvage_question_keys_json
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

export function publicRonaldoShirtQuizQuestions(questionKeys) {
  const keys =
    questionKeys ||
    getRonaldoShirtQuizCombinations()[0] ||
    WORLD_CUP_BALL_QUESTION_BANK.slice(0, RONALDO_SHIRT_QUIZ_QUESTION_COUNT).map((q) => q.questionKey)

  assertRonaldoShirtQuizQuestionKeysValid(keys)

  return getRonaldoShirtQuizQuestionsByKeys(keys).map((q, index) => {
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

export function publicRonaldoShirtQuizQuestion(questionKey) {
  return publicWorldCupBallQuestion(questionKey)
}

export function validateRonaldoShirtQuizAnswers(answers, questionKeys) {
  return validateWorldCupBallAnswers(answers, questionKeys)
}

export function countRonaldoShirtQuizWrongAnswers(validation, questionKeys) {
  return countWorldCupBallWrongAnswers(validation, questionKeys)
}

export function ronaldoShirtQuizAnsweredKeys(answers, questionKeys) {
  return worldCupBallAnsweredKeys(answers, questionKeys)
}

/** True when a partial base-25 attempt already has too many wrong answers to continue. */
export function shouldEndRonaldoShirtQuizEarly(answers, questionKeys) {
  const answeredKeys = ronaldoShirtQuizAnsweredKeys(answers, questionKeys)
  if (!answeredKeys.length || answeredKeys.length >= (questionKeys || []).length) return false
  const validation = validateRonaldoShirtQuizAnswers(answers, answeredKeys)
  const wrongCount = countRonaldoShirtQuizWrongAnswers(validation, answeredKeys)
  return wrongCount > RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE
}

export function buildRonaldoShirtQuizWrongReview(answers, questionKeys) {
  return buildWorldCupBallWrongReview(answers, questionKeys)
}

/** Pick a bonus salvage question outside the quiz set and any already-used salvage keys. */
export function pickRonaldoShirtQuizSalvageQuestion(excludedKeys) {
  return pickWorldCupBallSalvageQuestion(excludedKeys)
}

export function isRonaldoShirtQuizDisqualifiedByTimeouts(timeoutsUsed) {
  const n = Number(timeoutsUsed)
  if (!Number.isFinite(n) || n < 0) return true
  return n > RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS
}

/**
 * Core "what happens next" decision for the mistake-salvage state machine.
 *
 * Every mistake (up to {@link RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE}), whether
 * made on a base question or a previous salvage question, grants exactly one more
 * salvage question. Once every mistake made so far has been given a follow-up
 * chance (or there were no mistakes at all), the attempt is won. A mistake count
 * that exceeds the cap ends the attempt immediately.
 *
 * @param {{ totalWrongSoFar: number, salvageQuestionsIssued: number }} params
 * @returns {'won' | 'lost' | 'issue_salvage'}
 */
export function decideRonaldoShirtQuizNextStep({ totalWrongSoFar, salvageQuestionsIssued }) {
  const wrong = Number(totalWrongSoFar) || 0
  const issued = Number(salvageQuestionsIssued) || 0
  if (wrong > RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE) {
    return 'lost'
  }
  if (issued < wrong && issued < RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE) {
    return 'issue_salvage'
  }
  return 'won'
}
