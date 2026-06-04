import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WINNER_PHOTOGRAPHY_BUNDLE_TERMS_SUMMARY,
  winnerPhotographyConsentFaqAnswer,
} from './winnerPhotographyConsent.mjs'

test('winner photography FAQ answer covers consent and refusal rules', () => {
  const answer = winnerPhotographyConsentFaqAnswer()
  assert.match(answer, /photo or video shoot/i)
  assert.match(answer, /right to refuse/i)
  assert.match(answer, /valid reason/i)
  assert.match(answer, /not be sold to third parties/i)
  assert.match(answer, /Medical or health-related/i)
})

test('bundle terms summary references winner photography rules', () => {
  assert.match(WINNER_PHOTOGRAPHY_BUNDLE_TERMS_SUMMARY, /photo or video shoot/i)
  assert.match(WINNER_PHOTOGRAPHY_BUNDLE_TERMS_SUMMARY, /another winner/i)
})
