import { randomUUID } from 'node:crypto'
import { parseJsonBody, json } from '../lib/http.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'

/** Public: kick-ups giveaway submission (video URL or storage ref — never public-listed here). */
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

  if (!isDbConfigured()) {
    return json(res, 503, { error: 'Database not configured' })
  }

  const body = parseJsonBody(req)
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const videoRef = typeof body.videoUrl === 'string' ? body.videoUrl.trim().slice(0, 2000) : ''
  const videoFilename = typeof body.videoFilename === 'string' ? body.videoFilename.trim().slice(0, 500) : ''

  if (!fullName || !email.includes('@')) {
    return json(res, 400, { error: 'fullName and valid email required' })
  }
  if (!videoRef.startsWith('https://')) {
    return json(res, 400, { error: 'videoUrl must be an https URL' })
  }

  try {
    const id = randomUUID()
    const r = await query(
      `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, fullName, email, videoRef || null, videoFilename || null],
    )
    return json(res, 201, { ok: true, id: r.rows[0].id })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not save submission' })
  }
}
