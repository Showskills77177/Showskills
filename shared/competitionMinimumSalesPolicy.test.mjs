import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  MINIMUM_SALES_EXCEPTION_PRIZE_MAX_LABEL,
  MINIMUM_SALES_POLICY_FOOTNOTE,
  minimumSalesRulesMarkdown,
  minimumSalesThresholdFaqAnswer,
  ticketRefundsFaqAnswer,
  TICKET_NON_REFUND_SKILL_AND_VOLUNTARY,
} from './competitionMinimumSalesPolicy.mjs'

describe('competitionMinimumSalesPolicy', () => {
  it('FAQ answers cover refunds and minimum sales', () => {
    const refunds = ticketRefundsFaqAnswer()
    assert.match(refunds, /automatically refund/i)
    assert.match(refunds, /non-refundable/i)
    assert.ok(refunds.includes(MINIMUM_SALES_EXCEPTION_PRIZE_MAX_LABEL))

    const threshold = minimumSalesThresholdFaqAnswer()
    assert.match(threshold, /minimum ticket sales/i)
    assert.match(threshold, /exempt/i)
  })

  it('rules markdown distinguishes exempt competitions', () => {
    assert.match(minimumSalesRulesMarkdown({ exempt: false }), /refunded automatically/i)
    assert.match(minimumSalesRulesMarkdown({ exempt: true }), /may proceed/i)
    assert.ok(minimumSalesRulesMarkdown().includes(TICKET_NON_REFUND_SKILL_AND_VOLUNTARY))
  })

  it('footnote mentions automatic refund', () => {
    assert.match(MINIMUM_SALES_POLICY_FOOTNOTE, /refunded automatically/i)
  })
})
