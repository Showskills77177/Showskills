import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  validateWorldCupBallAnswers,
  isWorldCupBallDisqualifiedByTimeouts,
  WORLD_CUP_BALL_QUESTION_BANK,
} from './worldCupBallGiveaway.mjs'

describe('worldCupBallGiveaway', () => {
  it('requires all correct answers to win', () => {
    const questionKeys = WORLD_CUP_BALL_QUESTION_BANK.map((q) => q.questionKey)
    const answers = Object.fromEntries(
      WORLD_CUP_BALL_QUESTION_BANK.map((q) => [q.questionKey, q.acceptedAnswers[0]]),
    )
    const pass = validateWorldCupBallAnswers(answers, questionKeys)
    assert.equal(pass.allCorrect, true)

    const fail = validateWorldCupBallAnswers({ ...answers, q3: 'John Terry' }, questionKeys)
    assert.equal(fail.allCorrect, false)
    assert.equal(fail.perQuestion.q3, false)
  })

  it('disqualifies on second timeout', () => {
    assert.equal(isWorldCupBallDisqualifiedByTimeouts(0), false)
    assert.equal(isWorldCupBallDisqualifiedByTimeouts(1), false)
    assert.equal(isWorldCupBallDisqualifiedByTimeouts(2), true)
  })
})
