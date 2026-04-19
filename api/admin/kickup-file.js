import { requireAdmin } from '../lib/adminAuth.mjs'
import { query } from '../lib/db.mjs'
import { json } from '../lib/http.mjs'
import { resolveKickupFilePathFromRef, streamKickupFile } from '../lib/kickupUploads.mjs'

/** Admin-only: stream uploaded kick-up video. Query ?id=<submission uuid> */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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

  const submissionId =
    (typeof req.query?.id === 'string' && req.query.id) ||
    new URL(req.url || '/', 'http://local').searchParams.get('id') ||
    ''

  if (!submissionId) {
    return json(res, 400, { error: 'id query required' })
  }

  try {
    const r = await query(`SELECT video_ref FROM kickup_submissions WHERE id = $1`, [submissionId])
    const ref = r.rows[0]?.video_ref
    const path = resolveKickupFilePathFromRef(ref)
    if (!path) {
      return json(res, 404, { error: 'No uploaded file for this submission' })
    }

    const lower = path.toLowerCase()
    const type = lower.endsWith('.webm')
      ? 'video/webm'
      : lower.endsWith('.mov')
        ? 'video/quicktime'
        : 'video/mp4'

    res.statusCode = 200
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    streamKickupFile(path, res)
  } catch (e) {
    console.error(e)
    if (!res.headersSent) {
      return json(res, 500, { error: 'Could not read file' })
    }
  }
}
