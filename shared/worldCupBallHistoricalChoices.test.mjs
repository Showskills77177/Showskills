import test from 'node:test'
import assert from 'node:assert/strict'
import { answerMatchesWorldCupBallAnswer } from './worldCupBallAnswerMatching.mjs'
import { WORLD_CUP_BALL_QUESTION_BANK } from './worldCupBallQuestionBank.mjs'
import {
  WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT,
  WORLD_CUP_BALL_HISTORICAL_CHOICES_BY_KEY,
  isWorldCupBallHistoricalQuestion,
} from './worldCupBallHistoricalChoices.mjs'

test('every mapped historical key exists in the bank', () => {
  const keys = new Set(WORLD_CUP_BALL_QUESTION_BANK.map((q) => q.questionKey))
  for (const key of Object.keys(WORLD_CUP_BALL_HISTORICAL_CHOICES_BY_KEY)) {
    assert.ok(keys.has(key), `missing bank key ${key}`)
  }
})

test('historical questions (1980 and earlier) have six multiple-choice options', () => {
  for (const q of WORLD_CUP_BALL_QUESTION_BANK) {
    if (!isWorldCupBallHistoricalQuestion(q)) continue
    assert.equal(
      q.choices?.length,
      WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT,
      `${q.questionKey} should have ${WORLD_CUP_BALL_HISTORICAL_CHOICE_COUNT} choices`,
    )
    const hasCorrect = q.choices.some((choice) =>
      answerMatchesWorldCupBallAnswer(choice, q.acceptedAnswers),
    )
    assert.ok(hasCorrect, `${q.questionKey} choices must include a correct answer`)
  }
})
