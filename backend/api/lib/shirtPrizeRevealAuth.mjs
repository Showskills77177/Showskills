import { createHmac, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from './db.mjs'
import { ensureShirtEntrySchema } from './shirtEntryNumbers.mjs'
import {
  PRIZE_REVEAL_VIEW_SECONDS,
  PRIZE_REVEAL_IMAGE_GRACE_SECONDS,
} from '../../../shared/prizeReveal.mjs'
import { DEV_PREVIEW_RESUME_TOKEN } from '../../../shared/devEmailPreview.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../../..')

export const SHIRT_PRIZE_REVEAL_JERSEY_PATH = join(REPO_ROOT, 'src/assets/kickups-giveaway-jersey.png')

function revealSecret() {
  return (
    process.env.SHIRT_PRIZE_REVEAL_SECRET?.trim() ||
    process.env.PRIZE_REVEAL_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    'dev-shirt-prize-reveal-change-me'
  )
}

function signPayload(payload) {
  return createHmac('sha256', revealSecret()).update(payload).digest('base64url')
}

/** @param {string} submissionId */
export function createShirtPrizeRevealViewGrant(submissionId) {
  const id = String(submissionId || '').trim()
  if (!id) return null
  const viewSeconds = PRIZE_REVEAL_VIEW_SECONDS
  const ttl = viewSeconds + PRIZE_REVEAL_IMAGE_GRACE_SECONDS
  const exp = Math.floor(Date.now() / 1000) + ttl
  const sig = signPayload(`${id}.${exp}`)
  return {
    viewToken: `${exp}.${sig}`,
    viewSeconds,
    expiresAt: exp * 1000,
  }
}

/** @param {string} submissionId @param {string} viewToken */
export function verifyShirtPrizeRevealViewGrant(submissionId, viewToken) {
  const id = String(submissionId || '').trim()
  const raw = String(viewToken || '').trim()
  if (!id || !raw.includes('.')) return false
  const [expStr, sig] = raw.split('.', 2)
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  const expected = signPayload(`${id}.${exp}`)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function isLocalDevShirtPreviewToken(token) {
  if (token !== DEV_PREVIEW_RESUME_TOKEN) return false
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false
  if (process.env.NODE_ENV === 'production') return false
  return true
}

/** Shirt giveaway submission for this preview token. */
export async function resolveShirtPrizeRevealSubmission(previewToken) {
  const token = typeof previewToken === 'string' ? previewToken.trim() : ''
  if (token.length < 20) return null

  if (isLocalDevShirtPreviewToken(token)) {
    return {
      submissionId: 'dev-preview-shirt-reveal',
      entryNumber: 'SG-PREVIEW01',
      email: 'preview@local.test',
      alreadyViewed: false,
      isDevPreview: true,
    }
  }

  await ensureShirtEntrySchema()
  const r = await query(
    `SELECT id, entry_number, email, shirt_preview_viewed_at
     FROM kickup_submissions
     WHERE preview_token = $1 AND competition = $2`,
    [token, COMPETITION_SHIRT_GIVEAWAY],
  )
  const row = r.rows[0]
  if (!row?.id) return null
  return {
    submissionId: row.id,
    entryNumber: row.entry_number,
    email: row.email,
    alreadyViewed: Boolean(row.shirt_preview_viewed_at),
    isDevPreview: false,
  }
}

export async function markShirtPrizeRevealViewed(submissionId) {
  const id = String(submissionId || '').trim()
  if (!id || id === 'dev-preview-shirt-reveal') return
  await ensureShirtEntrySchema()
  await query(
    `UPDATE kickup_submissions SET shirt_preview_viewed_at = $2 WHERE id = $1 AND shirt_preview_viewed_at IS NULL`,
    [id, new Date().toISOString()],
  )
}

export function shirtPrizeRevealJerseyReady() {
  return existsSync(SHIRT_PRIZE_REVEAL_JERSEY_PATH)
}
