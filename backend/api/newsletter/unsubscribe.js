import { readJsonBody, json } from '../lib/http.mjs'
import { unsubscribeByToken } from '../lib/newsletter.mjs'

/** GET ?token= — unsubscribe (JSON). POST { token } — same. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const url = new URL(req.url || '/', 'http://local')
  let token =
    url.searchParams.get('token') ||
    (typeof req.body?.token === 'string' ? req.body.token : '')

  if (req.method === 'POST' && !token) {
    const body = await readJsonBody(req)
    token = typeof body.token === 'string' ? body.token : ''
  }

  const result = await unsubscribeByToken(String(token).trim())
  if (!result.ok) return json(res, 400, { error: result.error })

  return json(res, 200, {
    ok: true,
    email: result.email,
    message: 'You have been unsubscribed from ShowSkills Rewards emails.',
    already: Boolean(result.already),
  })
}
