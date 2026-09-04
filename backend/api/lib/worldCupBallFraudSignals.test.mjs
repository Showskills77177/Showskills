import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  WORLD_CUP_BALL_FRAUD_FLAG_THRESHOLD,
  assessWorldCupBallWinnerRisk,
} from './worldCupBallFraudSignals.mjs'

const NORMAL_SESSION = {
  started_at: '2024-01-01T00:00:00.000Z',
  submitted_at: '2024-01-01T00:05:00.000Z', // 5 minutes for 10 questions — plausible
  timeouts_used: 1,
  country_code: 'GB',
}

describe('worldCupBallFraudSignals', () => {
  it('does not flag a normal, unhurried completion with no other signals', () => {
    const result = assessWorldCupBallWinnerRisk({
      session: NORMAL_SESSION,
      vpnDetection: { blocked: false, uncertain: false, skipped: false },
      claimCountryCode: 'GB',
    })
    assert.equal(result.flagged, false)
    assert.equal(result.score, 0)
    assert.deepEqual(result.reasons, [])
  })

  it('flags an implausibly fast completion with zero timeouts', () => {
    const result = assessWorldCupBallWinnerRisk({
      session: {
        ...NORMAL_SESSION,
        submitted_at: '2024-01-01T00:00:05.000Z', // 5 seconds for 10 questions
        timeouts_used: 0,
      },
      vpnDetection: { blocked: false },
      claimCountryCode: 'GB',
    })
    assert.ok(result.score >= WORLD_CUP_BALL_FRAUD_FLAG_THRESHOLD)
    assert.equal(result.flagged, true)
    assert.ok(result.reasons.length >= 2)
  })

  it('adds risk for an uncertain VPN lookup', () => {
    const result = assessWorldCupBallWinnerRisk({
      session: NORMAL_SESSION,
      vpnDetection: { uncertain: true },
      claimCountryCode: 'GB',
    })
    assert.equal(result.score, 15)
    assert.equal(result.flagged, false)
  })

  it('adds risk for a dev/staging VPN bypass', () => {
    const result = assessWorldCupBallWinnerRisk({
      session: NORMAL_SESSION,
      vpnDetection: { skipped: true, reason: 'dev_bypass' },
      claimCountryCode: 'GB',
    })
    assert.equal(result.score, 10)
  })

  it('adds risk when the claim country differs from the session country', () => {
    const result = assessWorldCupBallWinnerRisk({
      session: NORMAL_SESSION,
      vpnDetection: {},
      claimCountryCode: 'US',
    })
    assert.equal(result.score, 20)
    assert.match(result.reasons[0], /does not match/)
  })

  it('caps the score at 100 even when every signal fires', () => {
    const result = assessWorldCupBallWinnerRisk({
      session: {
        ...NORMAL_SESSION,
        submitted_at: '2024-01-01T00:00:05.000Z',
        timeouts_used: 0,
      },
      vpnDetection: { uncertain: true },
      claimCountryCode: 'US',
    })
    assert.ok(result.score <= 100)
    assert.equal(result.flagged, true)
  })
})
