import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildNameAddressKey, buildShirtIdentityKey } from './freeEntryLimits.mjs'

test('buildNameAddressKey normalises spacing', () => {
  const a = buildNameAddressKey({
    fullName: '  John   Smith ',
    addressLine1: '35 Irvine Street',
    addressLine2: '',
    city: 'Liverpool',
    postcode: 'l7 8sy',
  })
  const b = buildNameAddressKey({
    fullName: 'john smith',
    addressLine1: '35 irvine street',
    addressLine2: '',
    city: 'liverpool',
    postcode: 'L7 8SY',
  })
  assert.equal(a, b)
})

test('buildShirtIdentityKey includes ip', () => {
  const k = buildShirtIdentityKey({
    fullName: 'Jane Doe',
    email: 'Jane@Example.com',
    ip: '1.2.3.4',
  })
  assert.match(k, /jane doe/)
  assert.match(k, /jane@example.com/)
  assert.match(k, /1.2.3.4/)
})
