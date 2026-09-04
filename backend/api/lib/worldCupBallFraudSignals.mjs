import { WORLD_CUP_BALL_QUESTION_COUNT } from '../../../shared/worldCupBallGiveaway.mjs'

/**
 * Heuristic risk scoring for World Cup Ball prize claims.
 *
 * IMPORTANT: this is NOT literal AI-content detection, bot detection, or any
 * kind of forensic proof of cheating. It is a lightweight heuristic that
 * combines a handful of loosely-correlated signals (completion speed, VPN
 * lookup confidence, and a country mismatch) into an approximate risk score
 * so an admin can prioritise which winner claims deserve a closer manual
 * look before fulfilment. Every flag can have a perfectly innocent
 * explanation (a fast, knowledgeable entrant; a VPN lookup timeout; a
 * traveller entering from a different country than they live in), so this
 * must never be used to auto-reject a claim — only to surface it for human
 * review in the admin winners tab.
 */

/** Score at/above this threshold marks the claim as "flagged" for review. */
export const WORLD_CUP_BALL_FRAUD_FLAG_THRESHOLD = 50

/** Roughly the fastest a genuine, attentive entrant could read + answer one question. */
const MIN_PLAUSIBLE_SECONDS_PER_QUESTION = 2.5

function secondsBetween(startIso, endIso) {
  if (!startIso || !endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return (end - start) / 1000
}

/**
 * Assess a winning World Cup Ball claim for heuristic fraud/scouting risk.
 *
 * @param {object} params
 * @param {object} params.session - the world_cup_ball_sessions row (started_at, submitted_at, timeouts_used, country_code).
 * @param {object} [params.vpnDetection] - the `detection` object returned by checkVpnForRequest().
 * @param {string} [params.claimCountryCode] - country code the entrant selected on the claim form.
 * @returns {{score: number, flagged: boolean, reasons: string[]}}
 */
export function assessWorldCupBallWinnerRisk({ session, vpnDetection, claimCountryCode } = {}) {
  const reasons = []
  let score = 0

  const completionSeconds = secondsBetween(session?.started_at, session?.submitted_at)
  const timeoutsUsed = Number(session?.timeouts_used) || 0

  if (completionSeconds != null) {
    const minPlausibleSeconds = WORLD_CUP_BALL_QUESTION_COUNT * MIN_PLAUSIBLE_SECONDS_PER_QUESTION
    if (completionSeconds < minPlausibleSeconds) {
      score += 35
      reasons.push(
        `Completed all ${WORLD_CUP_BALL_QUESTION_COUNT} questions in ${completionSeconds.toFixed(1)}s (faster than ${minPlausibleSeconds}s heuristic floor).`,
      )
      if (timeoutsUsed === 0) {
        score += 20
        reasons.push('No timeouts used during an unusually fast run.')
      }
    }
  }

  if (vpnDetection?.uncertain) {
    score += 15
    reasons.push('VPN/proxy lookup was inconclusive at claim time (uncertain result).')
  } else if (vpnDetection?.skipped && vpnDetection?.reason === 'dev_bypass') {
    score += 10
    reasons.push('VPN check was skipped via dev/staging bypass at claim time.')
  }

  const sessionCountry = typeof session?.country_code === 'string' ? session.country_code.toUpperCase() : ''
  const claimCountry = typeof claimCountryCode === 'string' ? claimCountryCode.toUpperCase() : ''
  if (sessionCountry && claimCountry && sessionCountry !== claimCountry) {
    score += 20
    reasons.push(`Claim-form country (${claimCountry}) does not match the country detected when the quiz started (${sessionCountry}).`)
  }

  score = Math.min(100, score)

  return {
    score,
    flagged: score >= WORLD_CUP_BALL_FRAUD_FLAG_THRESHOLD,
    reasons,
  }
}
