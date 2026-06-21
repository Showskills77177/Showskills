import { json } from './lib/http.mjs'
import { clearEditorTestCookieHeader } from './lib/editorTestAuth.mjs'

/** POST — clear editor test session. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  res.setHeader('Set-Cookie', clearEditorTestCookieHeader())
  return json(res, 200, { ok: true })
}
