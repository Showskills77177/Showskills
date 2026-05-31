import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POSTAL_ENTRY_ADDRESS,
  NO_PURCHASE_ENTRY_NOTICE,
  FOOTER_NO_PURCHASE_NOTICE,
  PROMOTER_ADDRESS_LINES,
  PROMOTER_STREET,
  PROMOTER_POSTCODE,
} from './competitionCopy.mjs'

test('postal entry address has no flat', () => {
  assert.equal(POSTAL_ENTRY_ADDRESS, 'ShowSkills Rewards, 35 Irvine Street, L7 8SY')
  assert.doesNotMatch(POSTAL_ENTRY_ADDRESS, /flat/i)
})

test('promoter address lines', () => {
  assert.deepEqual(PROMOTER_ADDRESS_LINES, [
    'ShowSkills Rewards',
    PROMOTER_STREET,
    PROMOTER_POSTCODE,
  ])
})

test('footer no purchase notice mentions free postal and card verification', () => {
  assert.match(NO_PURCHASE_ENTRY_NOTICE, /no purchase necessary/i)
  assert.match(NO_PURCHASE_ENTRY_NOTICE, /post/i)
  assert.match(NO_PURCHASE_ENTRY_NOTICE, /debit card/i)
  assert.match(NO_PURCHASE_ENTRY_NOTICE, /does not collect or store/i)
  assert.match(FOOTER_NO_PURCHASE_NOTICE, /Full terms/i)
})
