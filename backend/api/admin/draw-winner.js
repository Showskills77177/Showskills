import { requireAdmin } from '../lib/adminAuth.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import {
  DEFAULT_DRAW_COMPETITION,
  fetchDrawPoolSummary,
  listDrawRuns,
  runFairDraw,
} from '../lib/qualifiedDrawPool.mjs'

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
      const [summary, history] = await Promise.all([
        fetchDrawPoolSummary(competition),
        listDrawRuns(competition, 15),
      ])
      return json(res, 200, {
        ...summary,
        label: 'Ronaldo Legacy Bundle',
        history,
        notes: [
          'Each qualified ticket number is one entry in the draw (more tickets = more chances).',
          'Re-running the draw picks again from the same pool — for the real winner, run once when the competition closes.',
          'Only paid online entries with all three skill answers correct are included.',
          'Free postal entries are not stored in the database — handle those separately if applicable.',
        ],
      })
    }

    if (req.method === 'POST') {
      const result = await runFairDraw({ competition })
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
