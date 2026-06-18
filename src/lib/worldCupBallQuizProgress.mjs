const STORAGE_KEY = 'ss_wc_ball_quiz_progress'

/** @returns {object | null} */
export function loadWorldCupBallQuizProgress() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object' || typeof data.sessionId !== 'string') return null
    return data
  } catch {
    return null
  }
}

export function saveWorldCupBallQuizProgress(progress) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    /* ignore */
  }
}

export function clearWorldCupBallQuizProgress() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
