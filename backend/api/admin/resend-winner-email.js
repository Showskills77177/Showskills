import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured, query } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import { sendWinnerNotificationEmail } from '../lib/sendWinnerEmail.mjs'
import { getCompetitionPeriodById } from '../lib/competitionPeriods.mjs'

/** POST { drawId } — resend winner notification (testing or if email failed). */
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

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  const body = parseJsonBody(req)
  const drawId = typeof body.drawId === 'string' ? body.drawId.trim() : ''
  if (!drawId) {
    return json(res, 400, { error: 'drawId is required' })
  }

  try {
    const row = await query(
      `SELECT id, period_id, winning_ticket_number, winner_email, winner_full_name, winner_phone, drawn_at
       FROM draw_runs WHERE id = $1`,
      [drawId],
    )
    const draw = row.rows[0]
    if (!draw) {
      return json(res, 404, { error: 'Draw run not found' })
    }

    const period = draw.period_id ? await getCompetitionPeriodById(draw.period_id) : null
    const emailResult = await sendWinnerNotificationEmail({
      to: draw.winner_email,
      customerFullName: draw.winner_full_name,
      customerPhone: draw.winner_phone,
      winningTicketNumber: draw.winning_ticket_number,
      periodTitle: period?.title,
      drawnAt: draw.drawn_at,
    })

    if (emailResult.ok) {
      await query(
        `UPDATE draw_runs SET winner_email_sent_at = $2, winner_email_resend_id = $3 WHERE id = $1`,
        [drawId, new Date().toISOString(), emailResult.id || null],
      )
    }

    return json(res, 200, {
      ok: emailResult.ok,
      sent: Boolean(emailResult.ok),
      skipped: Boolean(emailResult.skipped),
      error: emailResult.error || null,
      resendId: emailResult.id || null,
      to: draw.winner_email,
    })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not resend winner email' })
  }
}
