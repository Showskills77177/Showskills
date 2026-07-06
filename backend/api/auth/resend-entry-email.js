import { readJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { getUserById } from '../lib/userAccounts.mjs'
import { resendPaidTicketEmailForUser } from '../lib/userResendEntryEmail.mjs'
import { getUserTokenFromReq, verifyUserSession } from '../lib/userAuth.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

/** POST { ticketId } — resend purchase or quiz-result email for a paid entry. */
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

  const limited =
    process.env.E2E_MODE === '1'
      ? { blocked: false }
      : applyRateLimit(req, res, { pathKey: 'auth-resend-entry-email', max: 6, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many email requests. Try again later.' })
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
  const ticketId = typeof body.ticketId === 'string' ? body.ticketId.trim() : ''
  if (!ticketId) {
    return json(res, 400, { error: 'ticketId is required' })
  }

  try {
    const result = await resendPaidTicketEmailForUser({ userId: user.id, ticketId })
    if (!result.ok) {
      return json(res, 400, { error: result.error || 'Could not send email' })
    }
    return json(res, 200, {
      ok: true,
      emailSent: true,
      type: result.type,
      message: 'Confirmation email sent.',
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not send email' })
  }
}
