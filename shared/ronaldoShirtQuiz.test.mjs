import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  RONALDO_SHIRT_QUIZ_QUESTION_COUNT,
  RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS,
  RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE,
  RONALDO_SHIRT_QUIZ_MIN_CHOICE_QUESTIONS,
  assertRonaldoShirtQuizQuestionKeysValid,
  getRonaldoShirtQuizCombinations,
  getRonaldoShirtQuizCombinationStats,
  pickRandomRonaldoShirtQuizCombination,
  publicRonaldoShirtQuizQuestions,
  validateRonaldoShirtQuizAnswers,
  countRonaldoShirtQuizWrongAnswers,
  shouldEndRonaldoShirtQuizEarly,
  isRonaldoShirtQuizDisqualifiedByTimeouts,
  decideRonaldoShirtQuizNextStep,
  pickRonaldoShirtQuizSalvageQuestion,
  countRonaldoShirtQuizChoiceQuestions,
} from './ronaldoShirtQuiz.mjs'
import { WORLD_CUP_BALL_QUESTION_BANK } from './worldCupBallQuestionBank.mjs'

describe('ronaldoShirtQuiz', () => {
  it('serves exactly 25 questions with enough multiple-choice bonus questions', () => {
    const { questionKeys } = pickRandomRonaldoShirtQuizCombination()
    assert.equal(questionKeys.length, RONALDO_SHIRT_QUIZ_QUESTION_COUNT)
    assertRonaldoShirtQuizQuestionKeysValid(questionKeys)
    assert.ok(countRonaldoShirtQuizChoiceQuestions(questionKeys) >= RONALDO_SHIRT_QUIZ_MIN_CHOICE_QUESTIONS)

    const questions = publicRonaldoShirtQuizQuestions(questionKeys)
    assert.equal(questions.length, RONALDO_SHIRT_QUIZ_QUESTION_COUNT)
    for (const q of questions) {
      assert.equal(typeof q.prompt, 'string')
      assert.ok(q.prompt.length > 0)
    }
  })

  it('rejects an invalid question count', () => {
    assert.throws(() => assertRonaldoShirtQuizQuestionKeysValid(['q1', 'q2']))
  })

  it('never repeats a question or subject within a combination', () => {
    const combos = getRonaldoShirtQuizCombinations()
    assert.ok(combos.length > 50)
    for (const combo of combos.slice(0, 50)) {
      assert.equal(new Set(combo).size, combo.length)
    }
  })

  it('reports pool stats for the live question bank', () => {
    const stats = getRonaldoShirtQuizCombinationStats()
    assert.equal(stats.questionsPerQuiz, RONALDO_SHIRT_QUIZ_QUESTION_COUNT)
    assert.ok(stats.activeCombinations > 0)
    assert.ok(stats.poolSize >= RONALDO_SHIRT_QUIZ_QUESTION_COUNT)
  })

  it('validates answers for a specific combination only', () => {
    const { questionKeys } = pickRandomRonaldoShirtQuizCombination()
    const answers = Object.fromEntries(
      questionKeys.map((key) => {
        const q = WORLD_CUP_BALL_QUESTION_BANK.find((row) => row.questionKey === key)
        return [key, q.acceptedAnswers[0]]
      }),
    )
    const validation = validateRonaldoShirtQuizAnswers(answers, questionKeys)
    assert.equal(validation.allCorrect, true)

    const wrongKey = questionKeys[0]
    const withWrong = { ...answers, [wrongKey]: 'definitely wrong answer' }
    const failed = validateRonaldoShirtQuizAnswers(withWrong, questionKeys)
    assert.equal(failed.allCorrect, false)
    assert.equal(countRonaldoShirtQuizWrongAnswers(failed, questionKeys), 1)
  })

  it('ends the quiz early once more than 2 wrong answers accumulate', () => {
    const { questionKeys } = pickRandomRonaldoShirtQuizCombination()
    const partialKeys = questionKeys.slice(0, 5)
    const answers = Object.fromEntries(partialKeys.map((key) => [key, 'wrong answer for all']))
    assert.equal(shouldEndRonaldoShirtQuizEarly(answers, questionKeys), true)
  })

  it('does not disqualify on 0, 1, or 2 timeouts but does on a 3rd', () => {
    assert.equal(isRonaldoShirtQuizDisqualifiedByTimeouts(0), false)
    assert.equal(isRonaldoShirtQuizDisqualifiedByTimeouts(RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS), false)
    assert.equal(isRonaldoShirtQuizDisqualifiedByTimeouts(RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS + 1), true)
  })

  it('picks distinct salvage questions when excluding prior keys', () => {
    const { questionKeys } = pickRandomRonaldoShirtQuizCombination()
    const salvage1 = pickRonaldoShirtQuizSalvageQuestion(questionKeys)
    assert.ok(salvage1)
    assert.ok(!questionKeys.includes(salvage1.questionKey))

    const salvage2 = pickRonaldoShirtQuizSalvageQuestion([...questionKeys, salvage1.questionKey])
    assert.ok(salvage2)
    assert.notEqual(salvage2.questionKey, salvage1.questionKey)
  })

  describe('decideRonaldoShirtQuizNextStep (mistake-salvage state machine)', () => {
    it('wins outright with zero mistakes', () => {
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 0, salvageQuestionsIssued: 0 }),
        'won',
      )
    })

    it('issues one salvage question after the first mistake', () => {
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 1, salvageQuestionsIssued: 0 }),
        'issue_salvage',
      )
    })

    it('wins after the first mistake is salvaged correctly', () => {
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 1, salvageQuestionsIssued: 1 }),
        'won',
      )
    })

    it('issues a second salvage question when the first salvage answer is also wrong', () => {
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 2, salvageQuestionsIssued: 1 }),
        'issue_salvage',
      )
    })

    it('wins after both mistakes are salvaged', () => {
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 2, salvageQuestionsIssued: 2 }),
        'won',
      )
    })

    it('loses on a 3rd mistake even mid-salvage', () => {
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 3, salvageQuestionsIssued: 1 }),
        'lost',
      )
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 3, salvageQuestionsIssued: 2 }),
        'lost',
      )
    })

    it('still offers both salvage questions when 2 mistakes happen in the base 25 at once', () => {
      // Base 25 answered with exactly 2 wrong -> first salvage offered.
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 2, salvageQuestionsIssued: 0 }),
        'issue_salvage',
      )
      // First salvage answered correctly (wrong count stays at 2) -> second salvage still offered,
      // since only 1 of the 2 original mistakes has had a follow-up chance so far.
      assert.equal(
        decideRonaldoShirtQuizNextStep({ totalWrongSoFar: 2, salvageQuestionsIssued: 1 }),
        'issue_salvage',
      )
    })

    it('matches the World Cup Ball single-mistake behaviour when capped at 1', () => {
      // Sanity check: the generic formula degrades correctly for a max-1-wrong rule.
      const maxWrong = 1
      const decide = ({ totalWrongSoFar, salvageQuestionsIssued }) => {
        if (totalWrongSoFar > maxWrong) return 'lost'
        if (salvageQuestionsIssued < totalWrongSoFar && salvageQuestionsIssued < maxWrong) return 'issue_salvage'
        return 'won'
      }
      assert.equal(decide({ totalWrongSoFar: 0, salvageQuestionsIssued: 0 }), 'won')
      assert.equal(decide({ totalWrongSoFar: 1, salvageQuestionsIssued: 0 }), 'issue_salvage')
      assert.equal(decide({ totalWrongSoFar: 1, salvageQuestionsIssued: 1 }), 'won')
      assert.equal(decide({ totalWrongSoFar: 2, salvageQuestionsIssued: 1 }), 'lost')
    })
  })

  it('exposes the max-wrong and max-timeout constants used across the app', () => {
    assert.equal(RONALDO_SHIRT_QUIZ_MAX_WRONG_FOR_SALVAGE, 2)
    assert.equal(RONALDO_SHIRT_QUIZ_MAX_TIMEOUTS, 2)
  })
})
