import { recordCashflowsPaymentFromVerifiedIntent } from './lib/recordCashflowsFromIntent.mjs'
import { getCashflowsConfig } from './lib/cashflows.mjs'
import { isDbConfigured, query } from './lib/db.mjs'
import { ensureTicketSchema } from './lib/ensureTicketSchema.mjs'

function parseWebhookBody(req) {
  if (req.body == null) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  if (typeof req.body === 'object') return req.body
  return {}
}

/**
 * Cashflows payment status webhook — confirms payment before updating orders (per Cashflows guidance).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!getCashflowsConfig().configured) {
    return res.status(503).json({ error: 'Cashflows not configured' })
  }

  const body = parseWebhookBody(req)
  const paymentJobReference =
    typeof body.paymentJobReference === 'string' ? body.paymentJobReference.trim() : ''
  const paymentReference =
    typeof body.paymentReference === 'string' ? body.paymentReference.trim() : ''

  if (!paymentJobReference) {
    return res.status(400).json({ error: 'paymentJobReference required' })
  }

  try {
    if (isDbConfigured()) {
      await ensureTicketSchema()
      const pending = await query(
        `SELECT u.email, u.full_name, u.phone, t.bundle_id
         FROM tickets t
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.cashflows_payment_job_reference = $1`,
        [paymentJobReference],
      )
      const row = pending.rows[0]
      if (row?.email) {
        await recordCashflowsPaymentFromVerifiedIntent({
          paymentJobReference,
          customerEmail: row.email,
          customerFullName: row.full_name || '',
          customerPhone: row.phone || '',
          bundleId: row.bundle_id || '',
        })
      }
    }

    return res.status(200).json({
      paymentJobReference,
      paymentReference: paymentReference || paymentJobReference,
    })
  } catch (e) {
    console.error('cashflows-webhook:', e)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
