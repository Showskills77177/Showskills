import { json } from './lib/http.mjs'
import { createCaptchaChallengeResponse, isCaptchaVerificationRequired } from './lib/captcha.mjs'
import { CAPTCHA_CHALLENGE_PATH } from '../../shared/captcha.mjs'

/** GET — self-hosted ALTCHA proof-of-work challenge (no third-party keys). */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isCaptchaVerificationRequired()) {
    return json(res, 200, { ok: true, enabled: false, challengePath: CAPTCHA_CHALLENGE_PATH })
  }

  try {
    const challenge = await createCaptchaChallengeResponse()
    res.setHeader('Cache-Control', 'no-store')
    return json(res, 200, { ok: true, enabled: true, ...challenge })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not create security challenge.' })
  }
}
