import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createPrizeRevealViewGrant,
  verifyPrizeRevealViewGrant,
} from '../backend/api/lib/prizeRevealAuth.mjs'

describe('prize reveal view grants', () => {
  it('signs and verifies a short-lived view token', () => {
    const grant = createPrizeRevealViewGrant('ticket-uuid-123')
    assert.ok(grant?.viewToken)
    assert.ok(verifyPrizeRevealViewGrant('ticket-uuid-123', grant.viewToken))
    assert.equal(verifyPrizeRevealViewGrant('other-ticket', grant.viewToken), false)
  })
})
