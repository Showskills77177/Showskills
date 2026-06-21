import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatWorldCupBallDrawMonthLabel,
  formatWorldCupBallMonthlyDrawAwardMessage,
  resolveWorldCupBallMonthlyDrawPeriod,
  WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS,
} from './worldCupBallMonthlyDraw.mjs'

describe('worldCupBallMonthlyDraw', () => {
  it('resolves June and July 2026 draw months', () => {
    assert.deepEqual(resolveWorldCupBallMonthlyDrawPeriod('2026-06-15T12:00:00.000Z'), {
      drawMonth: '2026-06',
      label: 'June 2026',
    })
    assert.deepEqual(resolveWorldCupBallMonthlyDrawPeriod('2026-07-02T12:00:00.000Z'), {
      drawMonth: '2026-07',
      label: 'July 2026',
    })
  })

  it('returns null outside the tournament summer unless preview mode', () => {
    assert.equal(resolveWorldCupBallMonthlyDrawPeriod('2026-05-21T12:00:00.000Z'), null)
    assert.equal(
      resolveWorldCupBallMonthlyDrawPeriod('2026-05-21T12:00:00.000Z', { promotionalPreview: true })?.drawMonth,
      WORLD_CUP_BALL_MONTHLY_DRAW_MONTHS[0],
    )
  })

  it('formats award message with entry number', () => {
    const message = formatWorldCupBallMonthlyDrawAwardMessage({
      entryNumber: 'WCD-ABC123',
      drawMonthLabel: formatWorldCupBallDrawMonthLabel('2026-06'),
    })
    assert.match(message, /WCD-ABC123/)
    assert.match(message, /June 2026/)
  })
})
