import { countryDisplayName } from '../../../shared/trafficSource.mjs'
import { query, dbIsPostgres } from './db.mjs'
import { ensureAnalyticsSchema } from './ensureAnalyticsSchema.mjs'

const PERIODS = new Set(['24h', '7d', '30d', 'all'])

/** @param {string} period */
export function parseSiteVisitsPeriod(period) {
  const key = String(period || '30d').trim().toLowerCase()
  return PERIODS.has(key) ? key : '30d'
}

/** @param {string} period */
function periodWhere(period) {
  if (period === 'all') return '1=1'
  const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30
  if (dbIsPostgres()) return `created_at >= now() - interval '${hours} hours'`
  return `created_at >= datetime('now', '-${hours} hours')`
}

/** @param {string} period @param {string} [countryCode] */
export async function loadAdminSiteVisitsReport({ period = '30d', countryCode = '', page = 1, pageSize = 40 } = {}) {
  await ensureAnalyticsSchema()

  const safePeriod = parseSiteVisitsPeriod(period)
  const timeWhere = periodWhere(safePeriod)
  const offset = (page - 1) * pageSize

  let countryFilter = ''
  const countryParams = []
  const normalizedCountry = String(countryCode || '').trim().toUpperCase()
  if (normalizedCountry && normalizedCountry !== 'ALL') {
    countryParams.push(normalizedCountry)
    countryFilter = ` AND COALESCE(country_code, 'XX') = $${countryParams.length}`
  }

  const summaryParams = [...countryParams]
  const [pageViews, uniqueSessions, countriesReached, topCountries, topPaths, topSources] = await Promise.all([
    query(`SELECT COUNT(*)::int AS c FROM site_visits WHERE ${timeWhere}${countryFilter}`, summaryParams),
    query(
      `SELECT CAST(COUNT(DISTINCT session_id) AS INTEGER) AS c FROM site_visits WHERE ${timeWhere}${countryFilter}`,
      summaryParams,
    ),
    query(
      `SELECT COUNT(DISTINCT COALESCE(country_code, 'XX'))::int AS c FROM site_visits WHERE ${timeWhere}${countryFilter}`,
      summaryParams,
    ),
    query(
      `SELECT COALESCE(country_code, 'XX') AS country_code, COUNT(*)::int AS visits,
              CAST(COUNT(DISTINCT session_id) AS INTEGER) AS unique_sessions
       FROM site_visits
       WHERE ${timeWhere}${countryFilter}
       GROUP BY 1
       ORDER BY visits DESC
       LIMIT 50`,
      summaryParams,
    ),
    query(
      `SELECT path, COUNT(*)::int AS visits
       FROM site_visits
       WHERE ${timeWhere}${countryFilter}
       GROUP BY path
       ORDER BY visits DESC
       LIMIT 12`,
      summaryParams,
    ),
    query(
      `SELECT traffic_source, COUNT(*)::int AS visits
       FROM site_visits
       WHERE ${timeWhere}${countryFilter}
       GROUP BY traffic_source
       ORDER BY visits DESC
       LIMIT 12`,
      summaryParams,
    ),
  ])

  const listParams = [...countryParams, pageSize, offset]
  const limitIdx = countryParams.length + 1
  const offsetIdx = countryParams.length + 2

  const countRes = await query(
    `SELECT COUNT(*)::int AS c FROM site_visits WHERE ${timeWhere}${countryFilter}`,
    countryParams,
  )
  const total = Number(countRes.rows[0]?.c ?? 0)

  const recentRes = await query(
    `SELECT session_id, path, country_code, country_name, traffic_source, referrer_host, created_at
     FROM site_visits
     WHERE ${timeWhere}${countryFilter}
     ORDER BY created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    listParams,
  )

  const totalVisits = pageViews.rows[0]?.c ?? 0
  const withShare = (rows, valueKey = 'visits') => {
    const sum = rows.reduce((acc, row) => acc + (row[valueKey] ?? 0), 0)
    return rows.map((row) => ({
      ...row,
      sharePct: sum ? Math.round(((row[valueKey] ?? 0) / sum) * 1000) / 10 : 0,
    }))
  }

  return {
    period: safePeriod,
    countryCode: normalizedCountry || null,
    summary: {
      pageViews: totalVisits,
      uniqueSessions: uniqueSessions.rows[0]?.c ?? 0,
      countriesReached: countriesReached.rows[0]?.c ?? 0,
    },
    visitsByCountry: withShare(
      topCountries.rows.map((row) => ({
        countryCode: row.country_code,
        countryName: countryDisplayName(row.country_code),
        visits: row.visits ?? 0,
        uniqueSessions: row.unique_sessions ?? 0,
      })),
    ),
    topPaths: topPaths.rows.map((row) => ({
      path: row.path,
      visits: row.visits ?? 0,
    })),
    topSources: topSources.rows.map((row) => ({
      source: row.traffic_source || 'Direct',
      visits: row.visits ?? 0,
    })),
    rows: recentRes.rows.map((row) => ({
      sessionId: row.session_id,
      path: row.path,
      countryCode: row.country_code || null,
      countryName: row.country_name || countryDisplayName(row.country_code) || 'Unknown',
      trafficSource: row.traffic_source || 'Direct',
      referrerHost: row.referrer_host || null,
      createdAt: row.created_at,
    })),
    total,
    page,
    pageSize,
  }
}
