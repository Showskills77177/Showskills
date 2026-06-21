import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import {
  fetchWorldCupBallMonthlyDrawSummary,
  runWorldCupBallMonthlyDraw,
} from '../lib/worldCupBallMonthlyDrawPool.mjs'
import { WORLD_CUP_BALL_MONTHLY_DRAW_GOVERNANCE } from '../../../shared/worldCupBallMonthlyDraw.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../../shared/worldCupBallGiveaway.mjs'

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

  try {
    if (req.method === 'GET') {
      const drawMonthParam = queryParam(req, 'drawMonth')?.trim() || ''
      let summary = await fetchWorldCupBallMonthlyDrawSummary(drawMonthParam)

      if (!drawMonthParam) {
        const defaultMonth =
          summary.months.find((m) => m.entryCount > 0)?.drawMonth || summary.months[0]?.drawMonth || ''
        if (defaultMonth && defaultMonth !== summary.drawMonth) {
          summary = await fetchWorldCupBallMonthlyDrawSummary(defaultMonth)
        }
      }

      return json(res, 200, {
        ...summary,
        label: WORLD_CUP_BALL_GIVEAWAY_LABEL,
        governance: WORLD_CUP_BALL_MONTHLY_DRAW_GOVERNANCE,
        notes: [
          WORLD_CUP_BALL_MONTHLY_DRAW_GOVERNANCE.isolation,
          WORLD_CUP_BALL_MONTHLY_DRAW_GOVERNANCE.oneDrawPerMonth,
          WORLD_CUP_BALL_MONTHLY_DRAW_GOVERNANCE.contact,
          'Each failed skill quiz awards one draw entry for that calendar month (Entry log flow: world_cup_ball_monthly_draw).',
        ],
      })
    }

    if (req.method === 'POST') {
      const body = parseJsonBody(req)
      const drawMonth = typeof body.drawMonth === 'string' ? body.drawMonth.trim() : ''
      const adminNotes = typeof body.adminNotes === 'string' ? body.adminNotes : ''

      const result = await runWorldCupBallMonthlyDraw({ drawMonth, adminNotes })
      if (!result.ok) {
        return json(res, 400, { error: result.error })
      }
      return json(res, 200, result)
    }

    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error('[world-cup-ball-draw]', e)
    return json(res, 500, { error: 'Monthly draw failed' })
  }
}
