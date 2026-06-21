import { json } from './lib/http.mjs'
import { isCaptchaVerificationRequired } from './lib/captcha.mjs'
import { CAPTCHA_CHALLENGE_PATH } from '../../shared/captcha.mjs'

/** GET — public CAPTCHA config (no secrets). */
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

  const enabled = isCaptchaVerificationRequired()

  return json(res, 200, {
    enabled,
    provider: 'altcha',
    challengeUrl: CAPTCHA_CHALLENGE_PATH,
  })
}
