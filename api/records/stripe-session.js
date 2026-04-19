import Stripe from 'stripe'
import { parseJsonBody, json } from '../lib/http.mjs'
import { recordStripeCheckoutCompleted } from '../lib/recordSale.mjs'
import { isDbConfigured, query } from '../lib/db.mjs'

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

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return json(res, 503, { error: 'Stripe not configured' })
  }

  const body = parseJsonBody(req)
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
  if (!sessionId.startsWith('cs_')) {
    return json(res, 400, { error: 'Invalid sessionId' })
  }

  if (!isDbConfigured()) {
    return json(res, 200, { ok: true, skipped: true, reason: 'no_database' })
  }

  try {
    const dup = await query(`SELECT id FROM tickets WHERE stripe_session_id = $1`, [sessionId])
    if (dup.rows[0]) {
      return json(res, 200, { ok: true, deduped: true })
    }

    const stripe = new Stripe(secret)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    })

    if (session.payment_status !== 'paid') {
      return json(res, 400, { error: 'Session not paid' })
    }

    const md = session.metadata || {}
    const qty = Math.max(1, parseInt(md.ticket_quantity, 10) || 1)
    const pi = session.payment_intent
    const piId = typeof pi === 'object' && pi?.id ? pi.id : String(session.payment_intent || '')

    const email = session.customer_details?.email || session.customer_email
    const fullName = md.customer_full_name || ''

    await recordStripeCheckoutCompleted({
      stripeSessionId: session.id,
      customerEmail: email,
      customerFullName: fullName,
      bundleId: md.bundle_id,
      quantity: qty,
      amountPence: session.amount_total || 0,
      currency: session.currency || 'gbp',
      paymentIntentId: piId || undefined,
    })

    return json(res, 200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: e instanceof Error ? e.message : 'Stripe error' })
  }
}
