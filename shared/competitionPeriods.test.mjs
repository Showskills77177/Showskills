import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isPeriodEligibleForDraw,
  PERIOD_STATUS,
  formatPeriodRange,
} from './competitionPeriods.mjs'

describe('competitionPeriods', () => {
  it('only closed periods may be drawn', () => {
    assert.equal(isPeriodEligibleForDraw(PERIOD_STATUS.closed), true)
    assert.equal(isPeriodEligibleForDraw(PERIOD_STATUS.open), false)
    assert.equal(isPeriodEligibleForDraw(PERIOD_STATUS.drawn), false)
  })

  it('formats entry window for display', () => {
    const s = formatPeriodRange('2026-01-01T12:00:00.000Z', '2026-06-01T12:00:00.000Z')
    assert.ok(s.includes('→'))
  })
})
