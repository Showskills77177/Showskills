import { parseJsonBody, json } from '../lib/http.mjs'
import { getSubscriberByToken, updateSubscriberPreferences } from '../lib/newsletter.mjs'

/** GET ?token= — load preferences. PATCH/POST { token, preferences } — save. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  const url = new URL(req.url || '/', 'http://local')
  const token =
    url.searchParams.get('token') ||
    (typeof req.body?.token === 'string' ? req.body.token : '')

  if (req.method === 'GET') {
    const sub = await getSubscriberByToken(String(token).trim())
    if (!sub) return json(res, 404, { error: 'Invalid or expired link.' })
    return json(res, 200, { ok: true, subscriber: sub })
  }

  if (req.method === 'POST' || req.method === 'PATCH') {
    const body = parseJsonBody(req)
    const t = typeof body.token === 'string' ? body.token : token
    const result = await updateSubscriberPreferences(String(t).trim(), body.preferences)
    if (!result.ok) return json(res, 400, { error: result.error })
    return json(res, 200, { ok: true, subscriber: result.subscriber })
  }

  res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS')
  return json(res, 405, { error: 'Method not allowed' })
}
