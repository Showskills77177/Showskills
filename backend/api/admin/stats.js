import { requireAdmin } from '../lib/adminAuth.mjs'
import { query } from '../lib/db.mjs'
import { loadAdminAnalytics } from '../lib/adminAnalytics.mjs'
import { json } from '../lib/http.mjs'

const EMPTY_ANALYTICS = {
  visits24h: 0,
  visits7d: 0,
  visits30d: 0,
  visitsAllTime: 0,
  activeVisitors24h: 0,
  activeVisitors7d: 0,
  registeredUsers: 0,
  newUsers30d: 0,
  visitsByCountry: [],
  trafficSources: [],
  ticketsByRegion: [],
  analyticsReady: false,
}

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

  try {
    const [tickets, revenue, entries, pending, analytics] = await Promise.all([
      query(`SELECT COALESCE(SUM(quantity),0)::int AS n FROM tickets WHERE payment_status = 'paid'`),
      query(`SELECT COALESCE(SUM(amount_pence),0)::bigint AS a FROM payments WHERE status = 'successful'`),
      query(`SELECT COUNT(*)::int AS c FROM competition_entries`),
      query(`SELECT COUNT(*)::int AS c FROM kickup_submissions WHERE review_status = 'pending'`),
      loadAdminAnalytics().catch((e) => {
        console.error('[admin/stats analytics]', e)
        return { ...EMPTY_ANALYTICS, analyticsReady: false }
      }),
    ])
    return json(res, 200, {
      ticketsSold: tickets.rows[0]?.n ?? 0,
      revenuePence: Number(revenue.rows[0]?.a ?? 0),
      entriesCount: entries.rows[0]?.c ?? 0,
      competitionsActive: 2,
      submissionsPending: pending.rows[0]?.c ?? 0,
      db: true,
      analytics: { ...analytics, analyticsReady: true },
    })
  } catch (e) {
    console.error(e)
    const msg = e instanceof Error ? e.message : String(e)
    const missing =
      msg.includes('no such table') ||
      msg.includes('SQLITE_CANTOPEN') ||
      msg.includes('unable to open database')
    if (missing) {
      return json(res, 200, {
        ticketsSold: 0,
        revenuePence: 0,
        entriesCount: 0,
        competitionsActive: 2,
        submissionsPending: 0,
        db: false,
        analytics: EMPTY_ANALYTICS,
        hint: 'Run: npm run db:setup && npm run db:schema (SQLite) or set DATABASE_URL for Postgres.',
      })
    }
    return json(res, 500, { error: 'Database error' })
  }
}
