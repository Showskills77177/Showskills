import { randomUUID } from 'node:crypto'
import { parseJsonBody, json } from '../lib/http.mjs'
import { query, isDbConfigured } from '../lib/db.mjs'
import {
  SHIRT_GIVEAWAY_QUESTION,
  isCorrectShirtGiveawayAnswer,
} from '../../../shared/shirtGiveaway.mjs'

/** Public: Ronaldo shirt giveaway submission. Also keeps legacy video-link support for old archived flows. */
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
  const qualificationAnswer =
    typeof body.qualificationAnswer === 'string' ? body.qualificationAnswer.trim().slice(0, 500) : ''

  if (!fullName || !email.includes('@')) {
    return json(res, 400, { error: 'fullName and valid email required' })
  }
  if (qualificationAnswer) {
    if (!isCorrectShirtGiveawayAnswer(qualificationAnswer)) {
      return json(res, 400, { error: 'Qualification answer is incorrect' })
    }
  } else if (!videoRef.startsWith('https://')) {
    return json(res, 400, { error: 'qualificationAnswer required' })
  }

  try {
    const id = randomUUID()
    const storedRef = qualificationAnswer ? 'answer:ronaldo-shirt-giveaway' : videoRef
    const storedFilename = qualificationAnswer ? `Answer: ${qualificationAnswer}` : videoFilename || null
    const adminNotes = qualificationAnswer
      ? `Question: ${SHIRT_GIVEAWAY_QUESTION}\nAnswer: ${qualificationAnswer}`
      : null
    const r = await query(
      `INSERT INTO kickup_submissions (id, full_name, email, video_ref, video_filename, admin_notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [id, fullName, email, storedRef || null, storedFilename, adminNotes],
    )
    return json(res, 201, { ok: true, id: r.rows[0].id })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not save submission' })
  }
}
