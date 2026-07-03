import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import { parseAdminListQuery, adminListMeta } from '../lib/adminPagination.mjs'
import { ensureWorldCupBallSchema } from '../lib/worldCupBallSchema.mjs'
import { query } from '../lib/db.mjs'
import { formatWorldCupBallDrawMonthLabel } from '../../../shared/worldCupBallMonthlyDraw.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from '../../../shared/worldCupBallGiveaway.mjs'
import { countryDisplayName } from '../../../shared/trafficSource.mjs'
import { resolveAndPersistCountriesForIps } from '../lib/ipCountryLookup.mjs'

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (!isDbConfigured()) {
    return json(res, 200, { rows: [], ...adminListMeta(0, 1, 40), label: WORLD_CUP_BALL_GIVEAWAY_LABEL })
  }

  try {
    await ensureWorldCupBallSchema()
    const url = new URL(req.url || '/', 'http://local')
    const { page, pageSize, offset } = parseAdminListQuery(url)
    const emailOnly = url.searchParams.get('emailOnly') === '1'
    const outcome = (url.searchParams.get('outcome') || '').trim()

    let where = `WHERE s.status IN ('lost', 'disqualified')`
    const params = []

    if (emailOnly) {
      where += ` AND COALESCE(NULLIF(TRIM(s.contact_email), ''), NULLIF(TRIM(e.email), '')) IS NOT NULL`
    }
    if (outcome === 'lost' || outcome === 'disqualified') {
      params.push(outcome)
      where += ` AND s.status = $${params.length}`
    }

    const countRes = await query(
      `SELECT COUNT(*)::int AS c
       FROM world_cup_ball_sessions s
       LEFT JOIN world_cup_ball_monthly_draw_entries e ON e.session_id = s.id
       ${where}`,
      params,
    )
    const total = Number(countRes.rows[0]?.c ?? 0)

    const listParams = [...params, pageSize, offset]
    const limitIdx = params.length + 1
    const offsetIdx = params.length + 2

    const r = await query(
      `SELECT
        s.id AS session_id,
        s.status AS outcome,
        s.ip_address,
        s.country_code,
        s.submitted_at,
        s.contact_email,
        e.entry_number,
        e.draw_month,
        e.email AS draw_entry_email
      FROM world_cup_ball_sessions s
      LEFT JOIN world_cup_ball_monthly_draw_entries e ON e.session_id = s.id
      ${where}
      ORDER BY COALESCE(s.submitted_at, s.started_at) DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      listParams,
    )

    const pageIps = r.rows
      .filter((row) => !row.country_code && row.ip_address)
      .map((row) => String(row.ip_address).trim())
    const extraRes = await query(
      `SELECT DISTINCT ip_address
       FROM world_cup_ball_sessions
       WHERE status IN ('lost', 'disqualified')
         AND (country_code IS NULL OR TRIM(country_code) = '')
         AND ip_address IS NOT NULL
         AND TRIM(ip_address) != ''
       LIMIT 25`,
    )
    const ipsToResolve = [
      ...new Set([
        ...pageIps,
        ...extraRes.rows.map((row) => String(row.ip_address || '').trim()).filter(Boolean),
      ]),
    ]

    const ipToCountry =
      ipsToResolve.length > 0
        ? await resolveAndPersistCountriesForIps(ipsToResolve, { maxLookups: 25, delayMs: 250 })
        : new Map()

    const rows = r.rows.map((row) => {
      const email = String(row.contact_email || row.draw_entry_email || '').trim() || null
      let countryCode = String(row.country_code || '').trim().toUpperCase() || null
      if (!countryCode && row.ip_address) {
        countryCode = ipToCountry.get(String(row.ip_address).trim()) || null
      }
      return {
        sessionId: row.session_id,
        outcome: row.outcome,
        email,
        ipAddress: row.ip_address || '',
        countryCode,
        countryName: countryCode ? countryDisplayName(countryCode) : null,
        submittedAt: row.submitted_at || null,
        drawEntryNumber: row.entry_number || null,
        drawMonth: row.draw_month || null,
        drawMonthLabel: row.draw_month ? formatWorldCupBallDrawMonthLabel(row.draw_month) : null,
      }
    })

    return json(res, 200, {
      rows,
      label: WORLD_CUP_BALL_GIVEAWAY_LABEL,
      emailOnly,
      outcome: outcome || null,
      ...adminListMeta(total, page, pageSize),
    })
  } catch (e) {
    console.error('[world-cup-ball-failed]', e)
    return json(res, 500, { error: 'Database error' })
  }
}
