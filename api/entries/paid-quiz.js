import { randomUUID } from 'node:crypto'
import { parseJsonBody, json } from '../lib/http.mjs'
import { query, isDbConfigured, isUniqueViolation, usePostgres } from '../lib/db.mjs'

/**
 * Public endpoint: persist Legacy Bundle quiz answers (paid or free entry_type).
 * Postal entries are not recorded here.
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

  const body = parseJsonBody(req)
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().slice(0, 200) : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 320) : ''
  const competition =
    typeof body.competition === 'string' ? body.competition.trim().slice(0, 120) : 'ronaldo_legacy_bundle'
  const entryType = body.entryType === 'free' ? 'free' : 'paid'
  const allCorrect = Boolean(body.allCorrect)
  const answers = body.answers && typeof body.answers === 'object' ? body.answers : {}

  if (!fullName || !email.includes('@')) {
    return json(res, 400, { error: 'fullName and valid email required' })
  }

  try {
    let userId
    const newUserId = randomUUID()
    try {
      await query(`INSERT INTO users (id, email, full_name) VALUES ($1, $2, $3) RETURNING id`, [
        newUserId,
        email,
        fullName,
      ])
      userId = newUserId
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const u = await query(`SELECT id FROM users WHERE lower(email) = $1`, [email])
      userId = u.rows[0].id
      await query(`UPDATE users SET full_name = $2 WHERE id = $1`, [userId, fullName])
    }

    const entryId = randomUUID()
    const allVal = usePostgres() ? allCorrect : allCorrect ? 1 : 0
    await query(
      `INSERT INTO competition_entries (id, user_id, competition, entry_type, answers_json, all_correct)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entryId, userId, competition, entryType, JSON.stringify(answers), allVal],
    )

    return json(res, 201, { ok: true })
  } catch (e) {
    console.error(e)
    return json(res, 500, { error: 'Could not save entry' })
  }
}
