import { requireAdmin } from '../lib/adminAuth.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import { ensureWorldCupBallSchema } from '../lib/worldCupBallSchema.mjs'

/** TEMPORARY diagnostic-only endpoint. Remove after use. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }
  if (!isDbConfigured()) return json(res, 503, { error: 'Database not configured' })
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    await ensureWorldCupBallSchema()
    const pathUrl = new URL(req.originalUrl || req.url || '/', 'http://local')
    const submissionId = (pathUrl.searchParams.get('submissionId') || '').trim()
    const ip = (pathUrl.searchParams.get('ip') || '').trim()
    const all = pathUrl.searchParams.get('all') === '1'

    let sessRes
    if (submissionId) {
      sessRes = await query(
        `SELECT * FROM world_cup_ball_sessions WHERE submission_id = $1`,
        [submissionId],
      )
    } else if (ip) {
      sessRes = await query(
        `SELECT * FROM world_cup_ball_sessions WHERE ip_address = $1 ORDER BY started_at DESC`,
        [ip],
      )
    } else if (all) {
      sessRes = await query(
        `SELECT * FROM world_cup_ball_sessions ORDER BY started_at ASC`,
      )
    } else {
      sessRes = await query(
        `SELECT * FROM world_cup_ball_sessions ORDER BY started_at DESC LIMIT 20`,
      )
    }

    const countRes = await query(`SELECT COUNT(*)::int AS c FROM world_cup_ball_sessions`)
    const winnersRes = await query(`SELECT * FROM world_cup_ball_winners ORDER BY created_at DESC LIMIT 20`)

    res.setHeader('Cache-Control', 'no-store')
    return json(res, 200, {
      totalSessions: countRes.rows[0]?.c ?? null,
      sessions: sessRes.rows,
      winners: winnersRes.rows,
    })
  } catch (e) {
    console.error('[wcb-session-debug]', e)
    return json(res, 500, { error: 'debug query failed', message: e instanceof Error ? e.message : String(e) })
  }
}
