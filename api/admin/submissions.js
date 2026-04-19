import { requireAdmin } from '../lib/adminAuth.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import { json, readJsonBody } from '../lib/http.mjs'
import { deleteLocalKickupFileFromRef } from '../lib/kickupUploads.mjs'

/** Express: use native .status().json() so the response always completes (avoids subtle res.end issues). */
function sendJson(res, status, data) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(data)
    return
  }
  json(res, status, data)
}

/** Prefer Express `express.json()` result; only read the stream when body is still empty. */
async function patchJsonBody(req) {
  if (
    req.body != null &&
    typeof req.body === 'object' &&
    !Array.isArray(req.body) &&
    Object.keys(req.body).length > 0
  ) {
    return req.body
  }
  return readJsonBody(req)
}

function normalizeKickupRows(rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => ({
    ...row,
    id: row?.id != null ? String(row.id) : row?.id,
  }))
}

/** Express strips the path from `req.url` after routing; `originalUrl` keeps `?query`. */
function searchParamsFromReq(req) {
  const pathAndQuery = req.originalUrl || req.url || '/'
  return new URL(pathAndQuery, 'http://local').searchParams
}

function firstQueryString(val) {
  if (Array.isArray(val)) return typeof val[0] === 'string' ? val[0] : ''
  return typeof val === 'string' ? val : ''
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  try {
    await requireAdmin(req)
  } catch {
    return sendJson(res, 401, { error: 'Unauthorized' })
  }

  if (!isDbConfigured()) {
    if (req.method === 'GET') return sendJson(res, 200, { rows: [] })
    return sendJson(res, 503, { error: 'Database not configured' })
  }

  try {
    if (req.method === 'GET') {
      const sp = searchParamsFromReq(req)
      const q = (firstQueryString(req.query?.q) || sp.get('q') || '').trim()
      const limitRaw = firstQueryString(req.query?.limit) || sp.get('limit') || '80'
      const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10)))
      let sql = `SELECT * FROM kickup_submissions WHERE 1=1`
      const params = []
      if (q) {
        params.push(`%${q}%`, `%${q}%`)
        sql += ` AND (email ILIKE $1 OR full_name ILIKE $2)`
      }
      sql += ` ORDER BY created_at DESC LIMIT ${limit}`
      const r = await query(sql, params)
      res.setHeader('Cache-Control', 'private, no-store')
      return sendJson(res, 200, { rows: normalizeKickupRows(r.rows) })
    }

    if (req.method === 'PATCH') {
      const body = await patchJsonBody(req)
      const id =
        typeof body.id === 'string'
          ? body.id.trim()
          : body.id != null
            ? String(body.id).trim()
            : ''
      if (!id) return sendJson(res, 400, { error: 'id required' })

      if (body.action === 'delete') {
        const row = await query(`SELECT video_ref FROM kickup_submissions WHERE id = $1`, [id])
        if (!row.rows?.length) return sendJson(res, 404, { error: 'Not found' })
        const ref = row.rows[0].video_ref
        const del = await query(`DELETE FROM kickup_submissions WHERE id = $1`, [id])
        const affected = del.rowCount ?? 0
        if (affected < 1) {
          return sendJson(res, 404, { error: 'Not found' })
        }
        if (ref) deleteLocalKickupFileFromRef(ref)
        res.setHeader('Cache-Control', 'no-store')
        return sendJson(res, 200, { ok: true, deleted: true })
      }

      const status = body.review_status
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return sendJson(res, 400, { error: 'invalid review_status' })
      }
      const notes = typeof body.admin_notes === 'string' ? body.admin_notes.slice(0, 2000) : null
      const upd = await query(
        `UPDATE kickup_submissions SET review_status = $1, admin_notes = COALESCE($2, admin_notes) WHERE id = $3`,
        [status, notes, id],
      )
      const affected = upd.rowCount ?? 0
      if (affected < 1) {
        return sendJson(res, 404, {
          error: 'Not found',
          hint: 'No row matched this id. Refresh the page; the list may be stale or the id may not match the server database.',
        })
      }
      res.setHeader('Cache-Control', 'no-store')
      return sendJson(res, 200, { ok: true })
    }

    if (req.method === 'DELETE') {
      const sp = searchParamsFromReq(req)
      const delId =
        firstQueryString(req.query?.id).trim() || sp.get('id')?.trim() || ''
      if (!delId) return sendJson(res, 400, { error: 'id query parameter required' })
      const row = await query(`SELECT video_ref FROM kickup_submissions WHERE id = $1`, [delId])
      if (!row.rows?.length) return sendJson(res, 404, { error: 'Not found' })
      const ref = row.rows[0].video_ref
      const del = await query(`DELETE FROM kickup_submissions WHERE id = $1`, [delId])
      if ((del.rowCount ?? 0) < 1) return sendJson(res, 404, { error: 'Not found' })
      if (ref) deleteLocalKickupFileFromRef(ref)
      return sendJson(res, 200, { ok: true })
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS')
    return sendJson(res, 405, { error: 'Method not allowed' })
  } catch (e) {
    console.error(e)
    return sendJson(res, 500, { error: 'Server error' })
  }
}
