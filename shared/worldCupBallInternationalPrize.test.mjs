import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WORLD_CUP_BALL_INTERNATIONAL_CASH_USD,
  isWorldCupBallUkCountry,
  normalizeWorldCupBallCountryCode,
  resolveWorldCupBallPrizeFulfilment,
  worldCupBallCashPrizeUsdForCountry,
} from './worldCupBallInternationalPrize.mjs'

describe('worldCupBallInternationalPrize', () => {
  it('treats GB and UK as ball fulfilment', () => {
    assert.equal(resolveWorldCupBallPrizeFulfilment('GB'), 'uk_ball')
    assert.equal(resolveWorldCupBallPrizeFulfilment('uk'), 'uk_ball')
    assert.ok(isWorldCupBallUkCountry('GB'))
  })

  it('offers international cash outside the UK', () => {
    assert.equal(resolveWorldCupBallPrizeFulfilment('US'), 'international_cash')
    assert.equal(resolveWorldCupBallPrizeFulfilment('CN'), 'international_cash')
    assert.equal(worldCupBallCashPrizeUsdForCountry('US'), WORLD_CUP_BALL_INTERNATIONAL_CASH_USD)
    assert.equal(worldCupBallCashPrizeUsdForCountry('GB'), null)
  })

  it('normalizes supported country codes', () => {
    assert.equal(normalizeWorldCupBallCountryCode(' us '), 'US')
    assert.equal(normalizeWorldCupBallCountryCode('ZZ'), null)
    assert.equal(normalizeWorldCupBallCountryCode(''), null)
  })
})
