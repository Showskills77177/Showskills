import { requireAdmin } from '../lib/adminAuth.mjs'
import { parseJsonBody, json } from '../lib/http.mjs'
import { isDbConfigured } from '../lib/db.mjs'
import { sendNewsletterCampaign } from '../lib/newsletter.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

/** POST { subject, bodyHtml, testEmail? } — send campaign via Resend. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const limited = applyRateLimit(req, res, { pathKey: 'newsletter-campaign', max: 3, windowMs: 300_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Campaign rate limit — wait a few minutes and try again.' })
  }

  const body = parseJsonBody(req)
  const subject = typeof body.subject === 'string' ? body.subject : ''
  const bodyHtml = typeof body.bodyHtml === 'string' ? body.bodyHtml : ''
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u) => typeof u === 'string').slice(0, 5)
    : []
  const campaignImages = Array.isArray(body.campaignImages)
    ? body.campaignImages
        .filter((item) => item && typeof item === 'object' && typeof item.url === 'string')
        .slice(0, 5)
    : []
  const testEmail = typeof body.testEmail === 'string' ? body.testEmail.trim() : ''
  const confirm = body.confirm === true || body.confirm === 'true'

  if (!testEmail && !confirm) {
    return json(res, 400, {
      error: 'Set confirm: true to send to all active subscribers, or provide testEmail for a test send.',
    })
  }

  try {
    const result = await sendNewsletterCampaign({
      subject,
      bodyHtml,
      imageUrls: campaignImages.length ? undefined : imageUrls,
      campaignImages: campaignImages.length ? campaignImages : undefined,
      testEmail: testEmail || undefined,
      createdBy: 'admin',
    })
    if (!result.ok) return json(res, 400, { error: result.error || 'Campaign failed' })
    return json(res, 200, { ok: true, ...result })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not send campaign.' })
  }
}
