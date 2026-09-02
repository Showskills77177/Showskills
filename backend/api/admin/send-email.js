import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured, query } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import { sendSalesEmail } from '../lib/sendSalesEmail.mjs'
import { generateWinnerChequePng } from '../lib/chequeGenerator.mjs'

/**
 * POST /api/admin/send-email
 * Body: { to, subject, message, recipientName?, submissionId?, attachCheque?, cheque? }
 *
 * Sends a branded, admin-composed email from sales@showskills.co.uk. When `submissionId`
 * refers to a World Cup Ball cash-prize winner and `attachCheque` is truthy (or omitted),
 * an auto-generated winner's cheque PNG is attached. Alternatively, an admin can supply
 * `cheque: { fullName, amountUsd, chequeNumber, dateIso? }` directly (e.g. for ad-hoc test
 * sends with no matching submission row) and the same cheque PNG will be generated/attached.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const body = parseJsonBody(req)
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : ''
  const subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const message = typeof body.message === 'string' ? body.message : ''
  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : ''
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  const attachCheque = body.attachCheque !== false

  if (!to.includes('@')) return json(res, 400, { error: 'A valid recipient email is required.' })
  if (!subject) return json(res, 400, { error: 'Subject is required.' })
  if (!message.trim()) return json(res, 400, { error: 'Message is required.' })

  let attachments
  try {
    if (submissionId && attachCheque && isDbConfigured()) {
      const r = await query(
        `SELECT ks.full_name, ks.entry_number AS win_reference,
                w.prize_fulfilment, w.cash_prize_usd, w.created_at AS won_at
         FROM kickup_submissions ks
         LEFT JOIN world_cup_ball_winners w ON w.submission_id = ks.id
         WHERE ks.id = $1`,
        [submissionId],
      )
      const winner = r.rows[0]
      if (winner?.prize_fulfilment === 'international_cash' && winner.cash_prize_usd && winner.win_reference) {
        const png = await generateWinnerChequePng({
          fullName: winner.full_name,
          amountUsd: winner.cash_prize_usd,
          chequeNumber: winner.win_reference,
          dateIso: winner.won_at,
        })
        attachments = [
          {
            filename: `${winner.win_reference}-winners-cheque.png`,
            content: png.toString('base64'),
            content_type: 'image/png',
          },
        ]
      }
    }

    // Manual override: admin-supplied cheque details, used when there's no matching
    // submission row (e.g. ad-hoc test sends) but a cheque should still be attached.
    if (!attachments && attachCheque && body.cheque && typeof body.cheque === 'object') {
      const { fullName, amountUsd, chequeNumber, dateIso } = body.cheque
      if (fullName && amountUsd && chequeNumber) {
        const png = await generateWinnerChequePng({
          fullName: String(fullName),
          amountUsd: Number(amountUsd),
          chequeNumber: String(chequeNumber),
          dateIso: dateIso || new Date().toISOString(),
        })
        attachments = [
          {
            filename: `${chequeNumber}-winners-cheque.png`,
            content: png.toString('base64'),
            content_type: 'image/png',
          },
        ]
      }
    }
  } catch (e) {
    console.error('[admin/send-email] Cheque generation failed, sending without attachment:', e)
  }

  try {
    const result = await sendSalesEmail({ to, subject, message, recipientName, attachments })
    return json(res, 200, {
      ok: Boolean(result.ok),
      sent: Boolean(result.ok),
      skipped: Boolean(result.skipped),
      error: result.error || null,
      resendId: result.id || null,
      chequeAttached: Boolean(attachments?.length),
      sandboxRedirect: Boolean(result.sandboxRedirect),
      deliveredTo: result.deliveredTo || null,
    })
  } catch (e) {
    console.error('[admin/send-email] Failed:', e)
    return json(res, 500, { error: 'Could not send email' })
  }
}
