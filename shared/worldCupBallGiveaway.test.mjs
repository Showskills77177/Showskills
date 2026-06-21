import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  validateWorldCupBallAnswers,
  isWorldCupBallDisqualifiedByTimeouts,
  buildWorldCupBallWrongReview,
  worldCupBallReviewCorrectAnswerDisplay,
  pickWorldCupBallSalvageQuestion,
  countWorldCupBallWrongAnswers,
  WORLD_CUP_BALL_QUESTION_BANK,
  worldCupBallAnsweredKeys,
  shouldEndWorldCupBallQuizEarly,
  WORLD_CUP_BALL_MAX_WRONG_FOR_SALVAGE,
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

  it('builds wrong-answer review rows', () => {
    const questionKeys = WORLD_CUP_BALL_QUESTION_BANK.slice(0, 10).map((q) => q.questionKey)
    const answers = Object.fromEntries(questionKeys.map((key) => [key, 'wrong']))
    answers[questionKeys[0]] = WORLD_CUP_BALL_QUESTION_BANK[0].acceptedAnswers[0]
    const validation = validateWorldCupBallAnswers(answers, questionKeys)
    assert.equal(countWorldCupBallWrongAnswers(validation, questionKeys), 9)
    const review = buildWorldCupBallWrongReview(answers, questionKeys)
    assert.equal(review.length, 9)
    assert.match(review[0].prompt, /./)
    assert.ok(review[0].correctAnswer)
    assert.notEqual(review[0].correctAnswer, review[0].yourAnswer)
  })

  it('picks a readable correct answer for review display', () => {
    const mc = WORLD_CUP_BALL_QUESTION_BANK.find((q) => q.questionKey === 'q4')
    assert.equal(worldCupBallReviewCorrectAnswerDisplay(mc), 'Lev Yashin')

    const goals = WORLD_CUP_BALL_QUESTION_BANK.find((q) => q.questionKey === 'q15')
    assert.equal(worldCupBallReviewCorrectAnswerDisplay(goals), '32 goals')
  })

  it('picks salvage question outside quiz set', () => {
    const questionKeys = WORLD_CUP_BALL_QUESTION_BANK.slice(0, 10).map((q) => q.questionKey)
    const salvage = pickWorldCupBallSalvageQuestion(questionKeys)
    assert.ok(salvage)
    assert.equal(questionKeys.includes(salvage.questionKey), false)
  })

  it('ends the quiz early after a second wrong answer', () => {
    const questionKeys = WORLD_CUP_BALL_QUESTION_BANK.slice(0, 4).map((q) => q.questionKey)
    const answers = {
      [questionKeys[0]]: WORLD_CUP_BALL_QUESTION_BANK[0].acceptedAnswers[0],
      [questionKeys[1]]: 'wrong',
    }
    assert.equal(shouldEndWorldCupBallQuizEarly(answers, questionKeys), false)

    answers[questionKeys[2]] = 'also wrong'
    assert.equal(shouldEndWorldCupBallQuizEarly(answers, questionKeys), true)
    assert.deepEqual(worldCupBallAnsweredKeys(answers, questionKeys), questionKeys.slice(0, 3))
  })
})
