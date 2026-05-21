import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validatePaidSkillAnswers } from './paidSkillQuestions.mjs'

test('Q3 accepts minute-only answers', () => {
  const ok = ['47', ' 47 ', '47th', '47th minute', 'minute 47', 'forty seven', '047', '47 min', '47mins']
  for (const q3 of ok) {
    const r = validatePaidSkillAnswers('Bolton 4-0', 'Nicky Butt', q3)
    assert.equal(r.q3, true, `expected q3 ok for: ${q3}`)
  }
})

test('Q1 accepts team-only or score-only', () => {
  assert.equal(validatePaidSkillAnswers('Bolton', 'Nicky Butt', '47').q1, true)
  assert.equal(validatePaidSkillAnswers('4-0', 'Nicky Butt', '47').q1, true)
  assert.equal(validatePaidSkillAnswers('4 nil', 'Nicky Butt', '47').q1, true)
  assert.equal(validatePaidSkillAnswers('Bolton Wanderers 4:0', 'Nicky Butt', '47').q1, true)
})

test('Q2 accepts common name variants', () => {
  assert.equal(validatePaidSkillAnswers('Bolton 4-0', 'Butt', '47').q2, true)
  assert.equal(validatePaidSkillAnswers('Bolton 4-0', 'Nick Butt', '47').q2, true)
  assert.equal(validatePaidSkillAnswers('Bolton 4-0', 'Nicholas Butt', '47').q2, true)
})

test('lenient trio qualifies', () => {
  const r = validatePaidSkillAnswers('Bolton', 'Butt', '47')
  assert.equal(r.allCorrect, true)
})

test('wrong answers still fail', () => {
  assert.equal(validatePaidSkillAnswers('wrong', 'wrong', 'wrong').allCorrect, false)
  assert.equal(validatePaidSkillAnswers('Bolton 4-0', 'Nicky Butt', '46').allCorrect, false)
})
