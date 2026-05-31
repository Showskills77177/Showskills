import { requireAdmin } from '../lib/adminAuth.mjs'
import { json } from '../lib/http.mjs'
import { storeCompetitionImageBuffer } from '../lib/competitionUploads.mjs'

function siteOriginFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000'
  return `${proto}://${host}`.replace(/\/$/, '')
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

  try {
    await requireAdmin(req)
  } catch {
    return json(res, 401, { error: 'Unauthorized' })
  }

  const file = req.file
  if (!file || !file.buffer?.length) {
    return json(res, 400, { error: 'Image file required (field name: image).' })
  }

  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  const mime = file.mimetype || 'image/jpeg'
  if (!allowed.has(mime)) {
    return json(res, 400, { error: 'Only JPEG, PNG, WebP, or GIF images are allowed.' })
  }
  if (file.size > 8 * 1024 * 1024) {
    return json(res, 400, { error: 'Image must be 8MB or smaller.' })
  }

  try {
    const ref = storeCompetitionImageBuffer(file.buffer, mime)
    const siteOrigin = siteOriginFromReq(req)
    const url = `${siteOrigin}/api/competition-image?ref=${encodeURIComponent(ref)}`
    return json(res, 201, { ok: true, ref, url })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Upload failed' })
  }
}
