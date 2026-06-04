import { createHmac, timingSafeEqual } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { query } from './db.mjs'
import { ensureTicketSchema } from './ensureTicketSchema.mjs'
import { DRAW_COMPETITION_SLUG } from '../../../shared/competitionPeriods.mjs'
import {
  PRIZE_REVEAL_VIEW_SECONDS,
  PRIZE_REVEAL_IMAGE_GRACE_SECONDS,
} from '../../../shared/prizeReveal.mjs'
import { PRIZE_REVEAL_ASSET_IDS } from '../../../shared/prizeRevealAssets.mjs'
import { DEV_PREVIEW_RESUME_TOKEN } from '../../../shared/devEmailPreview.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '../../..')

/** Same files as the public site (src/assets). */
export const PRIZE_REVEAL_POSTER_PATH = join(REPO_ROOT, 'src/assets/legacy-bundle-poster.png')
export const PRIZE_REVEAL_PHONE_PATH = join(REPO_ROOT, 'src/assets/iphone-17-pro-max-silver.png')
export const PRIZE_REVEAL_CASE_PATH = join(REPO_ROOT, 'src/assets/iphone-17-pro-max-gold-case.png')

/** @type {Record<string, { path: string, contentType: string }>} */
export const PRIZE_REVEAL_ASSETS = {
  poster: { path: PRIZE_REVEAL_POSTER_PATH, contentType: 'image/png' },
  phone: { path: PRIZE_REVEAL_PHONE_PATH, contentType: 'image/png' },
  case: { path: PRIZE_REVEAL_CASE_PATH, contentType: 'image/png' },
}

function revealSecret() {
  return (
    process.env.PRIZE_REVEAL_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    'dev-prize-reveal-change-me'
  )
}

function signPayload(payload) {
  return createHmac('sha256', revealSecret()).update(payload).digest('base64url')
}

/** @param {string} ticketId */
export function createPrizeRevealViewGrant(ticketId) {
  const id = String(ticketId || '').trim()
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

/** @param {string} ticketId @param {string} viewToken */
export function verifyPrizeRevealViewGrant(ticketId, viewToken) {
  const id = String(ticketId || '').trim()
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

export function isLocalDevPreviewResumeToken(token) {
  if (token !== DEV_PREVIEW_RESUME_TOKEN) return false
  if (process.env.VERCEL || process.env.VERCEL_ENV) return false
  if (process.env.NODE_ENV === 'production') return false
  return true
}

function isDevPreviewTicketId(ticketId) {
  return ticketId === 'dev-preview-prize-reveal'
}

async function latestPaidQuizAllCorrect(userId, sinceAt) {
  if (!userId || !sinceAt) return false
  const e = await query(
    `SELECT all_correct FROM competition_entries
     WHERE user_id = $1 AND entry_type = 'paid' AND competition = $2 AND created_at >= $3
     ORDER BY created_at DESC LIMIT 1`,
    [userId, DRAW_COMPETITION_SLUG, sinceAt],
  )
  const row = e.rows[0]
  if (!row) return false
  return row.all_correct === true || row.all_correct === 1
}

/** Whether this paid main-draw ticket may receive a prize-preview link or session. */
export async function getTicketPrizeRevealEligibility(ticketId, competition = DRAW_COMPETITION_SLUG) {
  const id = String(ticketId || '').trim()
  const comp = String(competition || DRAW_COMPETITION_SLUG).trim()
  if (!id || comp !== DRAW_COMPETITION_SLUG) {
    return { qualified: false, alreadyViewed: false, hasQuizEntry: false }
  }

  if (isDevPreviewTicketId(id)) {
    return { qualified: true, alreadyViewed: false, hasQuizEntry: true }
  }

  await ensureTicketSchema()
  const r = await query(
    `SELECT t.user_id, COALESCE(t.purchased_at, t.created_at) AS since_at, t.prize_reveal_viewed_at
     FROM tickets t
     WHERE t.id = $1 AND t.payment_status = 'paid' AND COALESCE(t.competition, $2) = $2`,
    [id, DRAW_COMPETITION_SLUG],
  )
  const row = r.rows[0]
  if (!row) {
    return { qualified: false, alreadyViewed: false, hasQuizEntry: false }
  }

  const e = await query(
    `SELECT 1 FROM competition_entries
     WHERE user_id = $1 AND entry_type = 'paid' AND competition = $2 AND created_at >= $3
     LIMIT 1`,
    [row.user_id, DRAW_COMPETITION_SLUG, row.since_at],
  )
  const hasQuizEntry = Boolean(e.rows[0])
  const qualified = hasQuizEntry && (await latestPaidQuizAllCorrect(row.user_id, row.since_at))
  const alreadyViewed = Boolean(row.prize_reveal_viewed_at)
  return { qualified, alreadyViewed, hasQuizEntry }
}

/** Marks the one-time preview as used (skipped for local dev preview ticket). */
export async function markPrizeRevealViewed(ticketId) {
  const id = String(ticketId || '').trim()
  if (!id || isDevPreviewTicketId(id)) return
  await ensureTicketSchema()
  await query(
    `UPDATE tickets SET prize_reveal_viewed_at = $2 WHERE id = $1 AND prize_reveal_viewed_at IS NULL`,
    [id, new Date().toISOString()],
  )
}

/** Paid Signed Football Legend Bundle ticket for this resume token. */
export async function resolvePrizeRevealTicket(resumeToken) {
  const token = typeof resumeToken === 'string' ? resumeToken.trim() : ''
  if (token.length < 20) return null

  if (isLocalDevPreviewResumeToken(token)) {
    return {
      ticketId: 'dev-preview-prize-reveal',
      orderRef: 'ORD-PREVIEW',
      email: 'preview@local.test',
      qualified: true,
      alreadyViewed: false,
      isDevPreview: true,
    }
  }

  await ensureTicketSchema()
  const r = await query(
    `SELECT t.id, t.ticket_public_id, u.email, t.user_id,
            COALESCE(t.purchased_at, t.created_at) AS since_at, t.prize_reveal_viewed_at
     FROM tickets t
     JOIN users u ON u.id = t.user_id
     WHERE t.quiz_resume_token = $1
       AND t.payment_status = 'paid'
       AND COALESCE(t.competition, $2) = $2`,
    [token, DRAW_COMPETITION_SLUG],
  )
  const row = r.rows[0]
  if (!row) return null
  const qualified = await latestPaidQuizAllCorrect(row.user_id, row.since_at)
  return {
    ticketId: row.id,
    orderRef: row.ticket_public_id,
    email: row.email,
    qualified,
    alreadyViewed: Boolean(row.prize_reveal_viewed_at),
    isDevPreview: false,
  }
}

/** @param {'poster' | 'phone' | 'case'} assetId */
export function prizeRevealAssetBytes(assetId) {
  const meta = PRIZE_REVEAL_ASSETS[String(assetId || '').trim()]
  if (!meta || !existsSync(meta.path)) return null
  return readFileSync(meta.path)
}

export function prizeRevealPosterBytes() {
  return prizeRevealAssetBytes('poster')
}

/** True when poster, phone, and unblurred case files are all present. */
export function prizeRevealAssetsReady() {
  return PRIZE_REVEAL_ASSET_IDS.every((id) => existsSync(PRIZE_REVEAL_ASSETS[id]?.path))
}
