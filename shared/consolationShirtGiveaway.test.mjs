import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSOLATION_MIN_SPEND_PENCE,
  CONSOLATION_SHIRT_ENTRY_COUNT,
  formatConsolationAwardMessage,
  paidSpendQualifiesForConsolation,
} from './consolationShirtGiveaway.mjs'

describe('consolationShirtGiveaway', () => {
  it('requires at least £10 for paid consolation', () => {
    assert.equal(CONSOLATION_SHIRT_ENTRY_COUNT, 2)
    assert.equal(CONSOLATION_MIN_SPEND_PENCE, 1000)
    assert.equal(paidSpendQualifiesForConsolation(999), false)
    assert.equal(paidSpendQualifiesForConsolation(1000), true)
    assert.equal(paidSpendQualifiesForConsolation(2500), true)
  })

  it('formats award message with entry count', () => {
    const msg = formatConsolationAwardMessage()
    assert.match(msg, /2 automatic entries/)
    assert.match(msg, /not refunded/i)
  })
})
