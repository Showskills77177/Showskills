import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  IPHONE_17_PRO_BUNDLES,
  IPHONE_17_PRO_CASH_ALTERNATIVE_PENCE,
  IPHONE_17_PRO_COMPETITION_SLUG,
  IPHONE_17_PRO_RETAIL_PENCE,
  getIphone17ProBundleById,
} from './iphone17ProCompetition.mjs'

describe('iphone17ProCompetition', () => {
  it('uses 29p single-ticket entry', () => {
    const single = getIphone17ProBundleById('single')
    assert.ok(single)
    assert.equal(single.totalPence, 29)
    assert.equal(single.qty, 1)
  })

  it('keeps cash alternative aligned with UK retail', () => {
    assert.equal(IPHONE_17_PRO_RETAIL_PENCE, 109900)
    assert.equal(IPHONE_17_PRO_CASH_ALTERNATIVE_PENCE, IPHONE_17_PRO_RETAIL_PENCE)
  })

  it('defines bundles for the catalog slug', () => {
    assert.ok(IPHONE_17_PRO_BUNDLES.length >= 5)
    assert.equal(IPHONE_17_PRO_COMPETITION_SLUG, 'iphone_17_pro')
  })
})
