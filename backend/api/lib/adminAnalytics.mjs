import { countryDisplayName } from '../../../shared/trafficSource.mjs'
import { query, dbIsPostgres } from './db.mjs'
import { ensureAnalyticsSchema } from './ensureAnalyticsSchema.mjs'

/** @param {number} hours */
function sinceHours(hours) {
  if (dbIsPostgres()) return `created_at >= now() - interval '${hours} hours'`
  return `created_at >= datetime('now', '-${hours} hours')`
}

/** @param {{ visits: number }[]} rows */
function withShare(rows) {
  const total = rows.reduce((sum, row) => sum + (row.visits || row.ticketsSold || 0), 0)
  return rows.map((row) => {
    const count = row.visits ?? row.ticketsSold ?? 0
    return {
      ...row,
      sharePct: total ? Math.round((count / total) * 1000) / 10 : 0,
    }
  })
}

export async function loadAdminAnalytics() {
  await ensureAnalyticsSchema()

  const [
    visits24h,
    visits7d,
    visits30d,
    visitsAll,
    activeVisitors24h,
    activeVisitors7d,
    registeredUsers,
    newUsers30d,
    visitsByCountry,
    trafficSources,
    ticketsByRegion,
  ] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM site_visits WHERE ${sinceHours(24)}`),
    query(`SELECT COUNT(*)::int AS c FROM site_visits WHERE ${sinceHours(24 * 7)}`),
    query(`SELECT COUNT(*)::int AS c FROM site_visits WHERE ${sinceHours(24 * 30)}`),
    query(`SELECT COUNT(*)::int AS c FROM site_visits`),
    query(`SELECT CAST(COUNT(DISTINCT session_id) AS INTEGER) AS c FROM site_visits WHERE ${sinceHours(24)}`),
    query(`SELECT CAST(COUNT(DISTINCT session_id) AS INTEGER) AS c FROM site_visits WHERE ${sinceHours(24 * 7)}`),
    query(`SELECT COUNT(*)::int AS c FROM users`),
    query(`SELECT COUNT(*)::int AS c FROM users WHERE ${sinceHours(24 * 30)}`),
    query(
      `SELECT COALESCE(country_code, 'XX') AS country_code, COUNT(*)::int AS visits
       FROM site_visits
       WHERE ${sinceHours(24 * 30)}
       GROUP BY 1
       ORDER BY visits DESC
       LIMIT 8`,
    ),
    query(
      `SELECT traffic_source, COUNT(*)::int AS visits
       FROM site_visits
       WHERE ${sinceHours(24 * 30)}
       GROUP BY traffic_source
       ORDER BY visits DESC
       LIMIT 10`,
    ),
    query(
      `SELECT COALESCE(p.country_code, 'XX') AS country_code,
              COALESCE(SUM(t.quantity), 0)::int AS tickets_sold,
              COALESCE(SUM(p.amount_pence), 0)::bigint AS revenue_pence
       FROM payments p
       JOIN tickets t ON t.id = p.ticket_id
       WHERE p.status = 'successful'
       GROUP BY 1
       ORDER BY tickets_sold DESC
       LIMIT 8`,
    ),
  ])

  return {
    visits24h: visits24h.rows[0]?.c ?? 0,
    visits7d: visits7d.rows[0]?.c ?? 0,
    visits30d: visits30d.rows[0]?.c ?? 0,
    visitsAllTime: visitsAll.rows[0]?.c ?? 0,
    activeVisitors24h: activeVisitors24h.rows[0]?.c ?? 0,
    activeVisitors7d: activeVisitors7d.rows[0]?.c ?? 0,
    registeredUsers: registeredUsers.rows[0]?.c ?? 0,
    newUsers30d: newUsers30d.rows[0]?.c ?? 0,
    visitsByCountry: withShare(
      visitsByCountry.rows.map((row) => ({
        countryCode: row.country_code,
        countryName: countryDisplayName(row.country_code),
        visits: row.visits ?? 0,
      })),
    ),
    trafficSources: withShare(
      trafficSources.rows.map((row) => ({
        source: row.traffic_source || 'Direct',
        visits: row.visits ?? 0,
      })),
    ),
    ticketsByRegion: ticketsByRegion.rows.map((row) => ({
      countryCode: row.country_code,
      countryName: countryDisplayName(row.country_code),
      ticketsSold: row.tickets_sold ?? 0,
      revenuePence: Number(row.revenue_pence ?? 0),
    })),
  }
}
