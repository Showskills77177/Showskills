import { randomBytes } from 'node:crypto'
import { query } from './db.mjs'
import { ensureShirtEntrySchema } from './shirtEntryNumbers.mjs'

function generateToken() {
  return randomBytes(24).toString('base64url')
}

/** Stable secret link for shirt prize preview + confirmation email. */
export async function ensureShirtPreviewToken(submissionId) {
  const id = String(submissionId || '').trim()
  if (!id) return ''
  await ensureShirtEntrySchema()
  const existing = await query(`SELECT preview_token FROM kickup_submissions WHERE id = $1`, [id])
  const row = existing.rows[0]
  if (row?.preview_token) return row.preview_token

  for (let attempt = 0; attempt < 8; attempt++) {
    const token = generateToken()
    try {
      await query(`UPDATE kickup_submissions SET preview_token = $2 WHERE id = $1 AND preview_token IS NULL`, [
        id,
        token,
      ])
      const check = await query(`SELECT preview_token FROM kickup_submissions WHERE id = $1`, [id])
      if (check.rows[0]?.preview_token) return check.rows[0].preview_token
    } catch {
      /* unique collision — retry */
    }
  }
  return ''
}
