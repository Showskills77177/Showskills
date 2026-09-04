import { RONALDO_SHIRT_QUIZ_QUESTION_COUNT } from '../../../shared/ronaldoShirtQuiz.mjs'

/**
 * Heuristic risk scoring for Ronaldo shirt giveaway quiz passes — the "same
 * filters" applied to the World Cup Ball giveaway, adapted for this quiz's
 * question count and timeout allowance.
 *
 * IMPORTANT: this is NOT literal AI-content detection, bot detection, or any
 * kind of forensic proof of cheating. It is a lightweight heuristic that
 * combines a handful of loosely-correlated signals (completion speed, VPN
 * lookup confidence, and a country mismatch) into an approximate risk score
 * so an admin can prioritise which entries deserve a closer manual look. It
 * must never be used to auto-reject an entry — only to surface it for human
 * review in the admin submissions tab.
 */

/** Score at/above this threshold marks the entry as "flagged" for review. */
export const RONALDO_SHIRT_QUIZ_FRAUD_FLAG_THRESHOLD = 50

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
 * Assess a passed Ronaldo shirt quiz attempt for heuristic fraud/scouting risk.
 *
 * @param {object} params
 * @param {object} params.session - the ronaldo_shirt_quiz_sessions row (started_at, submitted_at, timeouts_used, country_code).
 * @param {object} [params.vpnDetection] - the `detection` object returned by checkVpnForRequest().
 * @param {string} [params.entryCountryCode] - country code the entrant submitted on the entry form.
 * @returns {{score: number, flagged: boolean, reasons: string[]}}
 */
export function assessRonaldoShirtQuizWinnerRisk({ session, vpnDetection, entryCountryCode } = {}) {
  const reasons = []
  let score = 0

  const completionSeconds = secondsBetween(session?.started_at, session?.submitted_at)
  const timeoutsUsed = Number(session?.timeouts_used) || 0

  if (completionSeconds != null) {
    const minPlausibleSeconds = RONALDO_SHIRT_QUIZ_QUESTION_COUNT * MIN_PLAUSIBLE_SECONDS_PER_QUESTION
    if (completionSeconds < minPlausibleSeconds) {
      score += 35
      reasons.push(
        `Completed all ${RONALDO_SHIRT_QUIZ_QUESTION_COUNT} questions in ${completionSeconds.toFixed(1)}s (faster than ${minPlausibleSeconds}s heuristic floor).`,
      )
      if (timeoutsUsed === 0) {
        score += 20
        reasons.push('No timeouts used during an unusually fast run.')
      }
    }
  }

  if (vpnDetection?.uncertain) {
    score += 15
    reasons.push('VPN/proxy lookup was inconclusive at entry time (uncertain result).')
  } else if (vpnDetection?.skipped && vpnDetection?.reason === 'dev_bypass') {
    score += 10
    reasons.push('VPN check was skipped via dev/staging bypass at entry time.')
  }

  const sessionCountry = typeof session?.country_code === 'string' ? session.country_code.toUpperCase() : ''
  const entryCountry = typeof entryCountryCode === 'string' ? entryCountryCode.toUpperCase() : ''
  if (sessionCountry && entryCountry && sessionCountry !== entryCountry) {
    score += 20
    reasons.push(`Entry-form country (${entryCountry}) does not match the country detected when the quiz started (${sessionCountry}).`)
  }

  score = Math.min(100, score)

  return {
    score,
    flagged: score >= RONALDO_SHIRT_QUIZ_FRAUD_FLAG_THRESHOLD,
    reasons,
  }
}
