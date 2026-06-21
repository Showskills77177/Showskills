import { readJsonBody, json } from './lib/http.mjs'
import {
  isEditorTestLoginEnabled,
  setEditorTestCookieHeader,
  signEditorTestSession,
  verifyEditorTestPassword,
} from './lib/editorTestAuth.mjs'

/** POST — editor test login (VPN / IP quiz limits bypass). */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isEditorTestLoginEnabled()) {
    return json(res, 404, { error: 'Editor test login is not available on this site.' })
  }

  const body = await readJsonBody(req)
  const username = typeof body.username === 'string' ? body.username.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!verifyEditorTestPassword(username, password)) {
    return json(res, 401, { error: 'Invalid username or password.' })
  }

  try {
    const token = await signEditorTestSession(username)
    res.setHeader('Set-Cookie', setEditorTestCookieHeader(token))
    return json(res, 200, {
      ok: true,
      user: username,
      message: 'Editor test mode on — VPN and one-attempt IP limits are bypassed for the World Cup Ball quiz.',
    })
  } catch (e) {
    console.error('[editor-test] login failed:', e)
    return json(res, 503, { error: 'Login unavailable (server misconfigured).' })
  }
}
