import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  POSTAL_ENTRY_ADDRESS,
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
