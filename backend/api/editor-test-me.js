import { json } from './lib/http.mjs'
import {
  getEditorTestTokenFromReq,
  isEditorTestLoginEnabled,
  verifyEditorTestSession,
} from './lib/editorTestAuth.mjs'

/** GET — editor test session status. */
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

  const enabled = isEditorTestLoginEnabled()
  if (!enabled) {
    return json(res, 200, { ok: true, enabled: false, loggedIn: false })
  }

  const token = getEditorTestTokenFromReq(req)
  const session = await verifyEditorTestSession(token)
  return json(res, 200, {
    ok: true,
    enabled: true,
    loggedIn: Boolean(session),
    user: typeof session?.user === 'string' ? session.user : null,
    quizBypass: Boolean(session),
  })
}
