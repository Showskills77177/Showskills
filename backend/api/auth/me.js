import { json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { getUserById } from '../lib/userAccounts.mjs'
import { getUserTokenFromReq, verifyUserSession } from '../lib/userAuth.mjs'

/** GET — current signed-in user or 401. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Unavailable' })
  }

  const token = getUserTokenFromReq(req)
  const payload = await verifyUserSession(token)
  if (!payload) {
    return json(res, 401, { error: 'Not signed in' })
  }

  const user = await getUserById(payload.sub)
  if (!user) {
    return json(res, 401, { error: 'Not signed in' })
  }

  return json(res, 200, { ok: true, user })
}
