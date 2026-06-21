/**
 * Local dev / E2E only — skip one-device and single-winner limits so the quiz + claim form can be retested.
 * Never enabled on Vercel (including preview). Set WC_BALL_DEV_BYPASS=0 to test real limits locally.
 */
export function isWorldCupBallLocalDevBypass() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false
  if (process.env.WC_BALL_DEV_BYPASS === '0' || process.env.WC_BALL_DEV_BYPASS === 'false') return false
  if (process.env.E2E_MODE === '1' || process.env.E2E_MODE === 'true') return true
  if (process.env.WC_BALL_DEV_BYPASS === '1' || process.env.WC_BALL_DEV_BYPASS === 'true') return true
  return process.env.NODE_ENV !== 'production'
}

/** Local dev bypass or signed editor test cookie (home-page login). */
export async function isWorldCupBallQuizBypass(req) {
  if (isWorldCupBallLocalDevBypass()) return true
  if (!req) return false
  const { isEditorTestSession } = await import('./editorTestAuth.mjs')
  return isEditorTestSession(req)
}
