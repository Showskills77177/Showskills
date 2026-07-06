import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { getUserById } from '../lib/userAccounts.mjs'
import { getUserProfile, updateUserProfile } from '../lib/userProfile.mjs'
import { getUserTokenFromReq, verifyUserSession } from '../lib/userAuth.mjs'

async function requireSessionUser(req) {
  const token = getUserTokenFromReq(req)
  const payload = await verifyUserSession(token)
  if (!payload) {
    const err = new Error('Not signed in')
    err.statusCode = 401
    throw err
  }
  const user = await getUserById(payload.sub)
  if (!user) {
    const err = new Error('Not signed in')
    err.statusCode = 401
    throw err
  }
  return user
}

/** GET — profile. PATCH — update name, phone, addresses. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Unavailable' })
  }

  let user
  try {
    user = await requireSessionUser(req)
  } catch (err) {
    return json(res, err.statusCode || 401, { error: err.message || 'Not signed in' })
  }

  if (req.method === 'GET') {
    const profile = await getUserProfile(user.id)
    if (!profile) return json(res, 404, { error: 'Account not found.' })
    return json(res, 200, { ok: true, profile })
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req)
    const result = await updateUserProfile(user.id, body)
    if (!result.ok) return json(res, 400, { error: result.error })
    return json(res, 200, { ok: true, profile: result.profile, user: result.profile })
  }

  res.setHeader('Allow', 'GET, PATCH, OPTIONS')
  return json(res, 405, { error: 'Method not allowed' })
}
