import { randomUUID } from 'node:crypto'
import { resolveTrafficSource } from '../../../shared/trafficSource.mjs'
import { query } from './db.mjs'
import { ensureAnalyticsSchema } from './ensureAnalyticsSchema.mjs'
import { getCountryFromRequest } from './visitorGeo.mjs'
import { checkImpressionMilestone } from './impressionMilestoneAlerts.mjs'

function referrerHost(referrer) {
  if (!referrer || typeof referrer !== 'string') return null
  try {
    return new URL(referrer).hostname.replace(/^www\./, '').slice(0, 120) || null
  } catch {
    return null
  }
}

/**
 * @param {import('http').IncomingMessage} req
 * @param {{ sessionId: string, path: string, utmSource?: string, utmMedium?: string, utmCampaign?: string, referrer?: string }} body
 */
export async function recordPageView(req, body) {
  await ensureAnalyticsSchema()

  const sessionId = String(body.sessionId || '').trim().slice(0, 80)
  const path = String(body.path || '/').trim().slice(0, 500)
  if (!sessionId || !path.startsWith('/')) {
    throw new Error('Invalid analytics payload')
  }

  const utmSource = typeof body.utmSource === 'string' ? body.utmSource.trim().slice(0, 120) : null
  const utmMedium = typeof body.utmMedium === 'string' ? body.utmMedium.trim().slice(0, 120) : null
  const utmCampaign = typeof body.utmCampaign === 'string' ? body.utmCampaign.trim().slice(0, 120) : null
  const referrer = typeof body.referrer === 'string' ? body.referrer.trim().slice(0, 500) : null

  const geo = getCountryFromRequest(req)
  const trafficSource = resolveTrafficSource({ utmSource, utmMedium, referrer })

  await query(
    `INSERT INTO site_visits (
      id, session_id, path, country_code, country_name, traffic_source,
      utm_source, utm_medium, utm_campaign, referrer_host
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      randomUUID(),
      sessionId,
      path,
      geo.countryCode,
      geo.countryName,
      trafficSource,
      utmSource,
      utmMedium,
      utmCampaign,
      referrerHost(referrer),
    ],
  )

  const countResult = await query(`SELECT COUNT(*)::int AS c FROM site_visits`)
  const totalImpressions = Number(countResult.rows?.[0]?.c) || 0
  await checkImpressionMilestone(totalImpressions)

  return {
    ok: true,
    countryCode: geo.countryCode,
    trafficSource,
  }
}
