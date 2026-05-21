const STORAGE_KEY = 'ss_paid_quiz_session'

/**
 * @typedef {'pending' | 'answered'} PaidQuizSessionStatus
 * @typedef {{
 *   status: PaidQuizSessionStatus
 *   orderRef?: string
 *   ticketNumbers?: string[]
 *   email?: string
 *   fullName?: string
 *   quizResult?: 'qualified' | 'not_qualified' | null
 * }} PaidQuizSession
 */

/** @returns {PaidQuizSession | null} */
export function loadPaidQuizSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    if (data.status !== 'pending' && data.status !== 'answered') return null
    return {
      status: data.status,
      orderRef: typeof data.orderRef === 'string' ? data.orderRef : '',
      ticketNumbers: Array.isArray(data.ticketNumbers)
        ? data.ticketNumbers.filter((n) => typeof n === 'string')
        : [],
      email: typeof data.email === 'string' ? data.email.trim() : '',
      fullName: typeof data.fullName === 'string' ? data.fullName.trim() : '',
      quizResult:
        data.quizResult === 'qualified' || data.quizResult === 'not_qualified' ? data.quizResult : null,
    }
  } catch {
    return null
  }
}

/** @param {PaidQuizSession} session */
export function savePaidQuizSession(session) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        status: session.status,
        orderRef: session.orderRef || '',
        ticketNumbers: Array.isArray(session.ticketNumbers) ? session.ticketNumbers : [],
        email: session.email || '',
        fullName: session.fullName || '',
        quizResult: session.quizResult || null,
      }),
    )
  } catch {
    /* ignore */
  }
}

export function clearPaidQuizSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
