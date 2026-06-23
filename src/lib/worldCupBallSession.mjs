const STORAGE_KEY = 'ss_wc_ball_session'

/**
 * @typedef {{
 *   outcome?: { result: string, allCorrect?: boolean, disqualified?: boolean } | null
 *   claimToken?: string
 *   claimed?: boolean
 *   winnerEmailSent?: boolean
 *   winnerEmail?: { sent?: boolean, skipped?: boolean, error?: string | null } | null
 *   sessionId?: string
 *   contactEmailSaved?: boolean
 * }} WorldCupBallSession
 */

/** @returns {WorldCupBallSession | null} */
export function loadWorldCupBallSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return {
      outcome:
        data.outcome && typeof data.outcome === 'object' && typeof data.outcome.result === 'string'
          ? data.outcome
          : null,
      claimToken: typeof data.claimToken === 'string' ? data.claimToken : '',
      claimed: Boolean(data.claimed),
      winnerEmailSent: Boolean(data.winnerEmailSent),
      winnerEmail:
        data.winnerEmail && typeof data.winnerEmail === 'object'
          ? {
              sent: Boolean(data.winnerEmail.sent),
              skipped: Boolean(data.winnerEmail.skipped),
              error: typeof data.winnerEmail.error === 'string' ? data.winnerEmail.error : null,
            }
          : null,
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
      contactEmailSaved: Boolean(data.contactEmailSaved),
    }
  } catch {
    return null
  }
}

/** @param {WorldCupBallSession} session */
export function saveWorldCupBallSession(session) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        outcome: session.outcome || null,
        claimToken: session.claimToken || '',
        claimed: Boolean(session.claimed),
        winnerEmailSent: Boolean(session.winnerEmailSent),
        winnerEmail: session.winnerEmail || null,
        sessionId: session.sessionId || '',
        contactEmailSaved: Boolean(session.contactEmailSaved),
      }),
    )
  } catch {
    /* ignore */
  }
}

export function clearWorldCupBallSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
