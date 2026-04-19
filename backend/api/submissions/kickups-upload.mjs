import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { json } from '../lib/http.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import {
  ensureKickupUploadDir,
  KICKUP_UPLOAD_DIR,
  localVideoRef,
} from '../lib/kickupUploads.mjs'

function allowedVideo(mimetype, originalname) {
  if (mimetype && /^video\//.test(mimetype)) return true
  return /\.(mp4|webm|mov|m4v|mkv)$/i.test(originalname || '')
}

/**
 * POST multipart: fields fullName, email; file field "video".
 * Used by local Express (server.js + multer). Not available on Vercel serverless.
 */
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

  const file = req.file
  if (!file?.buffer?.length) {
    return json(res, 400, { error: 'Missing video file (form field name: video)' })
  }

  const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim().slice(0, 200) : ''
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 320) : ''

  if (!fullName || !email.includes('@')) {
    return json(res, 400, { error: 'fullName and valid email required' })
  }

  const orig = file.originalname || 'video.mp4'
  if (!allowedVideo(file.mimetype, orig)) {
    return json(res, 400, { error: 'File must be a video (e.g. mp4, webm, mov)' })
  }

  const ext = extname(orig) || '.mp4'
  const id = randomUUID()
  const stored = `${id}${ext}`

  ensureKickupUploadDir()
  const diskPath = join(KICKUP_UPLOAD_DIR, stored)
  writeFileSync(diskPath, file.buffer)

  const videoRef = localVideoRef(stored)

  try {
    await query(
      `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, fullName, email, videoRef, orig.slice(0, 500)],
    )
    return json(res, 201, { ok: true, id })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not save submission' })
  }
}
