import { requireAdmin } from '../lib/adminAuth.mjs'
import { generateAdminCopy, isAdminCopyAiConfigured } from '../lib/adminCopyAi.mjs'
import { readJsonBody, json } from '../lib/http.mjs'
import { applyRateLimit } from '../lib/rateLimit.mjs'

const ALLOWED_FIELDS = new Set(['competition_summary', 'competition_rules', 'bundle_checkout_line'])

function sanitizeContext(raw) {
  if (!raw || typeof raw !== 'object') return {}
  const out = {}
  for (const key of [
    'competitionTitle',
    'bundleTitle',
    'bundleQty',
    'bundlePriceGbp',
    'existingText',
  ]) {
    const value = raw[key]
    if (typeof value === 'string') out[key] = value.slice(0, 4000)
    else if (key === 'bundleQty' && Number.isFinite(Number(value))) out[key] = Number(value)
  }
  return out
}

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

  const limited = applyRateLimit(req, res, { pathKey: 'admin-generate-copy', max: 20, windowMs: 900_000 })
  if (limited.blocked) {
    return json(res, 429, { error: 'Too many AI requests. Wait a few minutes and try again.' })
  }

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  if (!isAdminCopyAiConfigured()) {
    return json(res, 503, {
      error: 'AI copy assistant is not configured. Set OPENAI_API_KEY on the server, then redeploy.',
    })
  }

  const body = await readJsonBody(req)
  const field = typeof body.field === 'string' ? body.field.trim() : ''
  if (!ALLOWED_FIELDS.has(field)) {
    return json(res, 400, { error: 'Invalid field.' })
  }

  const instructions = typeof body.instructions === 'string' ? body.instructions.slice(0, 2000) : ''
  const context = sanitizeContext(body.context)

  try {
    const result = await generateAdminCopy({ field, instructions, context })
    return json(res, 200, { ok: true, ...result })
  } catch (e) {
    console.error('[admin/generate-copy]', e)
    const msg = e instanceof Error ? e.message : 'Could not generate copy'
    return json(res, 500, { error: msg })
  }
}
