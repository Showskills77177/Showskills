import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  answerMatchesAccepted,
  validateCompetitionSkillAnswers,
  normalizeSkillQuestionInput,
  MAX_SKILL_QUESTIONS,
} from './competitionSkillQuestions.mjs'

describe('competitionSkillQuestions', () => {
  it('matches acceptable answers flexibly', () => {
    assert.equal(answerMatchesAccepted('Nicky Butt', ['Nicky Butt', 'Butt']), true)
    assert.equal(answerMatchesAccepted('butt', ['Nicky Butt']), true)
    assert.equal(answerMatchesAccepted('wrong', ['Bolton']), false)
  })

  it('requires exact digits for numeric-only answers', () => {
    assert.equal(answerMatchesAccepted('1099', ['1099', '£1,099']), true)
    assert.equal(answerMatchesAccepted('£1,099', ['1099']), true)
    assert.equal(answerMatchesAccepted('999', ['1099']), false)
    assert.equal(answerMatchesAccepted('1100', ['1099']), false)
  })

  it('validates dynamic question keys', () => {
    const questions = [
      { questionKey: 'q1', prompt: 'Q1', acceptedAnswers: ['Bolton'] },
      { questionKey: 'q2', prompt: 'Q2', acceptedAnswers: ['Butt'] },
    ]
    const ok = validateCompetitionSkillAnswers(questions, { q1: 'Bolton', q2: 'Butt' })
    assert.equal(ok.allCorrect, true)
    assert.equal(ok.q1, true)
    assert.equal(ok.q2, true)

    const bad = validateCompetitionSkillAnswers(questions, { q1: 'Bolton', q2: 'wrong' })
    assert.equal(bad.allCorrect, false)
    assert.equal(bad.q2, false)
  })

  it('normalizes admin input', () => {
    const row = normalizeSkillQuestionInput(
      { prompt: '  Test?  ', acceptedAnswers: [' a ', '', 'b'] },
      2,
    )
    assert.equal(row.questionKey, 'q3')
    assert.equal(row.prompt, 'Test?')
    assert.deepEqual(row.acceptedAnswers, ['a', 'b'])
  })

  it('caps max questions constant', () => {
    assert.equal(MAX_SKILL_QUESTIONS, 10)
  })
})
