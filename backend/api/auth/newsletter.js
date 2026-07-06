import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { getUserById } from '../lib/userAccounts.mjs'
import { setUserNewsletterSubscription } from '../lib/userProfile.mjs'
import { getUserTokenFromReq, verifyUserSession } from '../lib/userAuth.mjs'

/** PATCH { subscribed: boolean } */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH, OPTIONS')
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

  const body = await readJsonBody(req)
  const subscribed = body.subscribed === true

  const result = await setUserNewsletterSubscription(user.id, subscribed)
  if (!result.ok) return json(res, 400, { error: result.error })

  return json(res, 200, { ok: true, subscribed: result.subscribed })
}
