import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import {
  DEFAULT_DRAW_COMPETITION,
  fetchDrawPoolSummary,
  listDrawRuns,
  runFairDraw,
} from '../lib/qualifiedDrawPool.mjs'
import {
  listCompetitionPeriods,
  resolvePeriodForAdmin,
} from '../lib/competitionPeriods.mjs'
import {
  DRAW_COMPETITION_LABEL,
  PERIOD_COPY,
  PERIOD_STATUS_LABELS,
  formatPeriodRange,
  isPeriodEligibleForDraw,
} from '../../../shared/competitionPeriods.mjs'

function queryParam(req, key) {
  try {
    const raw = typeof req.url === 'string' ? req.url : ''
    const u = new URL(raw, 'http://localhost')
    return u.searchParams.get(key)
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

  const competition = DEFAULT_DRAW_COMPETITION

  try {
    if (req.method === 'GET') {
      const periodId = queryParam(req, 'periodId')
      const resolved = await resolvePeriodForAdmin(competition, periodId)
      if (!resolved.ok) return json(res, 400, { error: resolved.error })

      const period = resolved.period
      const allPeriods = resolved.periods ?? (await listCompetitionPeriods(competition))

      const [summary, history] = await Promise.all([
        fetchDrawPoolSummary(competition, period),
        listDrawRuns(competition, { periodId: period.id, limit: 15 }),
      ])

      const canDraw = isPeriodEligibleForDraw(period.status) && summary.poolSize > 0

      return json(res, 200, {
        ...summary,
        label: DRAW_COMPETITION_LABEL,
        period: {
          ...period,
          statusLabel: PERIOD_STATUS_LABELS[period.status] || period.status,
          entryWindowLabel: formatPeriodRange(period.entryOpensAt, period.entryClosesAt),
        },
        periods: allPeriods.map((p) => ({
          ...p,
          statusLabel: PERIOD_STATUS_LABELS[p.status] || p.status,
          entryWindowLabel: formatPeriodRange(p.entryOpensAt, p.entryClosesAt),
        })),
        canDraw,
        governance: PERIOD_COPY,
        notes: [
          PERIOD_COPY.isolation,
          PERIOD_COPY.closeBeforeDraw,
          PERIOD_COPY.drawnArchive,
          'Each qualified ticket number within this period is one draw chance (more tickets = higher odds).',
          PERIOD_COPY.postalNote,
        ],
        history,
      })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      const periodId = typeof body.periodId === 'string' ? body.periodId.trim() : ''
      if (!periodId) {
        return json(res, 400, { error: 'periodId is required. Select the closed competition period to draw from.' })
      }

      const resolved = await resolvePeriodForAdmin(competition, periodId)
      if (!resolved.ok) return json(res, 400, { error: resolved.error })

      const result = await runFairDraw({
        competition,
        period: resolved.period,
        sendWinnerEmail: body.sendWinnerEmail !== false,
      })
      if (!result.ok) {
        return json(res, 400, { error: result.error })
      }
      return json(res, 200, result)
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Draw failed' })
  }
}
