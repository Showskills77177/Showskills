import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import {
  createCompetitionPeriod,
  ensureDefaultCompetitionPeriod,
  listCompetitionPeriods,
  updateCompetitionPeriodStatus,
} from '../lib/competitionPeriods.mjs'
import { DRAW_COMPETITION_SLUG, PERIOD_STATUS } from '../../../shared/competitionPeriods.mjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
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

  const competition = DRAW_COMPETITION_SLUG

  try {
    if (req.method === 'GET') {
      await ensureDefaultCompetitionPeriod(competition)
      const periods = await listCompetitionPeriods(competition)
      return json(res, 200, { ok: true, competition, periods })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      const summary = typeof body.summary === 'string' ? body.summary.trim() : ''
      const entryOpensAt = body.entryOpensAt || body.entry_opens_at
      const entryClosesAt = body.entryClosesAt || body.entry_closes_at
      const status =
        typeof body.status === 'string' && Object.values(PERIOD_STATUS).includes(body.status)
          ? body.status
          : PERIOD_STATUS.draft

      if (!title || !entryOpensAt || !entryClosesAt) {
        return json(res, 400, { error: 'title, entryOpensAt, and entryClosesAt are required.' })
      }

      const created = await createCompetitionPeriod({
        competition,
        title,
        summary,
        entryOpensAt,
        entryClosesAt,
        status,
      })
      if (!created.ok) return json(res, 400, { error: created.error })
      return json(res, 201, created)
    }

    if (req.method === 'PATCH') {
      const body = parseJsonBody(req)
      const periodId = typeof body.periodId === 'string' ? body.periodId.trim() : ''
      const status = typeof body.status === 'string' ? body.status.trim() : ''
      if (!periodId || !status) {
        return json(res, 400, { error: 'periodId and status are required.' })
      }
      const updated = await updateCompetitionPeriodStatus(periodId, status)
      if (!updated.ok) return json(res, 400, { error: updated.error })
      return json(res, 200, updated)
    }

    res.setHeader('Allow', 'GET, POST, PATCH, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not update competition period.' })
  }
}
