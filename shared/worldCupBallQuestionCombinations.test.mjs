import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildWorldCupBallCombinations,
  combinationCount,
  combinationHasExclusionConflict,
  WORLD_CUP_BALL_COMBINATION_TARGET,
} from './worldCupBallQuestionCombinations.mjs'
import {
  assertWorldCupBallQuestionKeysValid,
  getWorldCupBallCombinationStats,
  countWorldCupBallChoiceQuestions,
  getWorldCupBallExclusionGroupByKey,
  getWorldCupBallQuestionCombinations,
  pickRandomWorldCupBallCombination,
  publicWorldCupBallQuestions,
  validateWorldCupBallAnswers,
  WORLD_CUP_BALL_QUESTION_BANK,
  WORLD_CUP_BALL_QUESTION_COUNT,
  WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS,
} from './worldCupBallGiveaway.mjs'

describe('worldCupBallQuestionCombinations', () => {
  it('builds unique combinations up to the target cap', () => {
    const pool = Array.from({ length: 30 }, (_, i) => `q${i + 1}`)
    const combos = buildWorldCupBallCombinations(pool, 25, 300)
    assert.equal(combos.length, 300)
    const signatures = new Set(combos.map((c) => [...c].sort().join('|')))
    assert.equal(signatures.size, 300)
    for (const combo of combos) {
      assert.equal(combo.length, 25)
    }
  })

  it('reports pool stats for the live question bank', () => {
    const stats = getWorldCupBallCombinationStats()
    assert.equal(stats.poolSize, WORLD_CUP_BALL_QUESTION_BANK.length)
    assert.equal(stats.questionsPerQuiz, WORLD_CUP_BALL_QUESTION_COUNT)
    assert.equal(stats.targetCombinations, WORLD_CUP_BALL_COMBINATION_TARGET)
    assert.equal(stats.activeCombinations, WORLD_CUP_BALL_COMBINATION_TARGET)
    assert.ok(stats.activeCombinations <= stats.maxPossibleCombinations)
  })

  it('never repeats a question or subject within a combination', () => {
    const exclusionGroupByKey = getWorldCupBallExclusionGroupByKey()
    const combos = getWorldCupBallQuestionCombinations()
    for (const combo of combos) {
      assertWorldCupBallQuestionKeysValid(combo)
      assert.equal(combinationHasExclusionConflict(combo, exclusionGroupByKey), false)
      assert.ok(
        countWorldCupBallChoiceQuestions(combo) >= WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS,
        `combo must include at least ${WORLD_CUP_BALL_MIN_CHOICE_QUESTIONS} multiple-choice bonus questions`,
      )
    }
  })
})

describe('worldCupBallGiveaway combinations', () => {
  it('serves only the questions from the picked combination', () => {
    const { questionKeys } = pickRandomWorldCupBallCombination()
    const publicQs = publicWorldCupBallQuestions(questionKeys)
    assert.equal(publicQs.length, WORLD_CUP_BALL_QUESTION_COUNT)
    assert.deepEqual(
      publicQs.map((q) => q.questionKey),
      questionKeys,
    )
  })

  it('validates answers for a specific combination only', () => {
    const combos = getWorldCupBallQuestionCombinations()
    const questionKeys = combos[0]
    const answers = Object.fromEntries(
      questionKeys.map((key) => {
        const q = WORLD_CUP_BALL_QUESTION_BANK.find((row) => row.questionKey === key)
        return [key, q.acceptedAnswers[0]]
      }),
    )
    const pass = validateWorldCupBallAnswers(answers, questionKeys)
    assert.equal(pass.allCorrect, true)

    const fail = validateWorldCupBallAnswers(
      { ...answers, [questionKeys[0]]: 'zzzznotavalidfootballanswer' },
      questionKeys,
    )
    assert.equal(fail.allCorrect, false)
  })
})
