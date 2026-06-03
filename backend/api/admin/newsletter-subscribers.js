import { requireAdmin } from '../lib/adminAuth.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import {
  exportNewsletterSubscribersCsv,
  listNewsletterSubscribers,
  subscribeNewsletter,
} from '../lib/newsletter.mjs'

/** GET — paginated subscribers or ?export=csv. POST — add/reactivate subscriber. */
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
    if (req.method === 'POST') {
      return json(res, 503, { error: 'Database not configured' })
    }
    return json(res, 200, { rows: [], total: 0, totalPages: 1, page: 1, pageSize: 50 })
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req)
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    if (!email) return json(res, 400, { error: 'Email is required.' })

    try {
      const result = await subscribeNewsletter(email, { source: 'admin_import', resubscribe: true })
      if (!result.ok) return json(res, 400, { error: result.error || 'Could not add subscriber.' })
      return json(res, 200, { ok: true, email: result.email, subscriber: result.subscriber })
    } catch (e) {
      console.error(e)
      return json(res, 500, { error: 'Could not add subscriber.' })
    }
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    const url = new URL(req.url || '/', 'http://local')
    if (url.searchParams.get('export') === 'csv') {
      const status = url.searchParams.get('status') || 'active'
      const csv = await exportNewsletterSubscribersCsv({ status })
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="newsletter-subscribers-${status}.csv"`)
      return res.status(200).end(csv)
    }

    const data = await listNewsletterSubscribers(url)
    return json(res, 200, { ok: true, ...data })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not load newsletter subscribers.' })
  }
}
