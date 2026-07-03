import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { lookupCountryCodeFromIp } from '../backend/api/lib/ipCountryLookup.mjs'

describe('ipCountryLookup', () => {
  it('returns null for private IPs without calling external APIs', async () => {
    assert.equal(await lookupCountryCodeFromIp('127.0.0.1'), null)
    assert.equal(await lookupCountryCodeFromIp('192.168.1.1'), null)
    assert.equal(await lookupCountryCodeFromIp(''), null)
  })
})
