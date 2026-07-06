import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { query, dbIsPostgres } from './db.mjs'

function emailLikeClause(paramIndex) {
  return dbIsPostgres() ? `email ILIKE $${paramIndex}` : `LOWER(email) LIKE LOWER($${paramIndex})`
}
import { normalizeNewsletterPreferences } from '../../../shared/newsletter.mjs'
import {
  getResendApiKey,
  resolveResendFrom,
  formatResendError,
  resolveSiteUrl,
  isResendProductionMode,
} from './resendConfig.mjs'
import { resolveCompetitionImagePathFromRef } from './competitionUploads.mjs'
import { parseAdminListQuery, adminListMeta } from './adminPagination.mjs'
import { getSitePageLayout } from './siteLayoutStore.mjs'
import { EMAIL_LAYOUT_PAGE_ID } from '../../../shared/emailLayout.mjs'
import {
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  welcomeEmailSubject,
  buildCampaignEmailHtml,
  buildCampaignEmailText,
  campaignDefaultSubject,
} from '../../../shared/newsletterEmail.mjs'
import { resolvePublicSiteUrlForEmail } from '../../../shared/purchaseConfirmationEmail.mjs'
import { normalizeCampaignImages } from '../../../shared/newsletterCampaignImages.mjs'

let schemaEnsured = false

function tokenFromEmail(email) {
  const secret = (process.env.NEWSLETTER_TOKEN_SECRET || process.env.ADMIN_SESSION_SECRET || 'dev-newsletter').trim()
  return createHash('sha256').update(`${secret}:${email}`).digest('hex').slice(0, 48)
}

export async function ensureNewsletterSchema() {
  if (schemaEnsured) return

  if (dbIsPostgres()) {
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        source TEXT,
        subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        unsubscribed_at TIMESTAMPTZ,
        unsubscribe_token TEXT UNIQUE,
        preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        welcome_sent_at TIMESTAMPTZ
      )
    `)
    try {
      await query(
        `CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers (subscribed_at DESC) WHERE unsubscribed_at IS NULL`,
      )
    } catch {
      /* sqlite or older postgres */
    }
    for (const col of [
      `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ`,
      `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT UNIQUE`,
      `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS preferences_json JSONB NOT NULL DEFAULT '{}'::jsonb`,
      `ALTER TABLE newsletter_subscribers ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ`,
    ]) {
      try {
        await query(col)
      } catch {
        /* already exists */
      }
    }
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_campaigns (
        id UUID PRIMARY KEY,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        sent_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by TEXT
      )
    `)
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        source TEXT,
        subscribed_at TEXT NOT NULL,
        unsubscribed_at TEXT,
        unsubscribe_token TEXT UNIQUE,
        preferences_json TEXT NOT NULL DEFAULT '{}',
        welcome_sent_at TEXT
      )
    `)
    for (const col of [
      `ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribed_at TEXT`,
      `ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribe_token TEXT`,
      `ALTER TABLE newsletter_subscribers ADD COLUMN preferences_json TEXT DEFAULT '{}'`,
      `ALTER TABLE newsletter_subscribers ADD COLUMN welcome_sent_at TEXT`,
    ]) {
      try {
        await query(col)
      } catch {
        /* already exists */
      }
    }
    await query(`
      CREATE TABLE IF NOT EXISTS newsletter_campaigns (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        body_html TEXT NOT NULL,
        sent_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        created_by TEXT
      )
    `)
  }

  const missing = await query(
    `SELECT email FROM newsletter_subscribers WHERE unsubscribe_token IS NULL OR unsubscribe_token = '' LIMIT 500`,
  )
  for (const row of missing.rows) {
    const em = String(row.email || '').toLowerCase()
    if (!em) continue
    await query(`UPDATE newsletter_subscribers SET unsubscribe_token = $1 WHERE email = $2`, [
      tokenFromEmail(em) + randomBytes(4).toString('hex'),
      em,
    ])
  }

  schemaEnsured = true
}

function mapSubscriberRow(row) {
  if (!row) return null
  const prefs = normalizeNewsletterPreferences(
    typeof row.preferences_json === 'string' ? JSON.parse(row.preferences_json || '{}') : row.preferences_json,
  )
  return {
    id: row.id,
    email: row.email,
    source: row.source || null,
    subscribedAt: row.subscribed_at,
    unsubscribedAt: row.unsubscribed_at || null,
    active: !row.unsubscribed_at,
    preferences: prefs,
    unsubscribeToken: row.unsubscribe_token || null,
  }
}

export function buildNewsletterManageUrls(token) {
  const site = resolvePublicSiteUrlForEmail(resolveSiteUrl()).replace(/\/$/, '')
  const t = encodeURIComponent(token || '')
  return {
    preferencesUrl: `${site}/newsletter/preferences?token=${t}`,
    unsubscribeUrl: `${site}/newsletter/unsubscribe?token=${t}`,
  }
}

function contentTypeForFilename(name) {
  const lower = String(name || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function buildInlineImageAttachment({ filename, content, contentType, contentId }) {
  return {
    filename,
    content,
    content_type: contentType,
    content_id: contentId,
    resolvedUrl: `cid:${contentId}`,
  }
}

function attachmentFromLocalImagePath(filePath, contentId) {
  const filename = basename(filePath)
  return buildInlineImageAttachment({
    filename,
    content: readFileSync(filePath).toString('base64'),
    contentType: contentTypeForFilename(filename),
    contentId,
  })
}

function attachmentFromCompetitionImageUrl(url) {
  try {
    const u = new URL(url)
    if (!u.pathname.endsWith('/api/competition-image')) return null
    const ref = decodeURIComponent(u.searchParams.get('ref') || '')
    const path = resolveCompetitionImagePathFromRef(ref)
    if (!path) return null
    return attachmentFromLocalImagePath(path, `campaign-${randomBytes(4).toString('hex')}`)
  } catch {
    return null
  }
}

function attachmentFromPublicEmailCampaignPath(url) {
  try {
    const u = new URL(url)
    const match = u.pathname.match(/\/email\/campaigns\/([^/]+)$/)
    if (!match) return null
    const filePath = join(process.cwd(), 'public', 'email', 'campaigns', basename(match[1]))
    if (!existsSync(filePath)) return null
    return attachmentFromLocalImagePath(filePath, `campaign-${randomBytes(4).toString('hex')}`)
  } catch {
    return null
  }
}

function normalizeImageFetchUrl(url) {
  return String(url)
    .replace('://localhost:5173', '://localhost:3000')
    .replace('://127.0.0.1:5173', '://127.0.0.1:3000')
}

async function attachmentFromImageUrl(url) {
  const raw = String(url || '').trim()
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) return null

  const fromDisk = attachmentFromCompetitionImageUrl(raw) || attachmentFromPublicEmailCampaignPath(raw)
  if (fromDisk) return fromDisk

  try {
    const res = await fetch(normalizeImageFetchUrl(raw))
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length) return null
    const contentType = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
    const ext = contentType.includes('png')
      ? '.png'
      : contentType.includes('webp')
        ? '.webp'
        : contentType.includes('gif')
          ? '.gif'
          : '.jpg'
    return buildInlineImageAttachment({
      filename: `campaign${ext}`,
      content: buf.toString('base64'),
      contentType,
      contentId: `campaign-${randomBytes(4).toString('hex')}`,
    })
  } catch {
    return null
  }
}

/** Embed campaign images inline for email clients (Proton, etc.) — remote URLs are fetched at send time. */
export async function resolveCampaignEmailImages(imageInput) {
  const images = normalizeCampaignImages(imageInput)
  const resolvedImages = []
  const attachments = []
  for (const img of images) {
    const u = String(img.url || '').trim()
    if (!u) continue
    if (u.startsWith('cid:')) {
      resolvedImages.push({ ...img, url: u })
      continue
    }
    if (!u.startsWith('http://') && !u.startsWith('https://')) continue

    const att = await attachmentFromImageUrl(u)
    if (att) {
      attachments.push({
        filename: att.filename,
        content: att.content,
        content_id: att.content_id,
        content_type: att.content_type,
      })
      resolvedImages.push({ ...img, url: att.resolvedUrl })
    } else {
      resolvedImages.push(img)
    }
    if (resolvedImages.length >= 5) break
  }
  return { campaignImages: resolvedImages.slice(0, 5), attachments }
}

export async function subscribeNewsletter(email, { source = 'shirt_giveaway', preferences, resubscribe = true } = {}) {
  await ensureNewsletterSchema()
  const em = String(email || '')
    .trim()
    .toLowerCase()
  if (!em.includes('@')) return { ok: false, error: 'Valid email required for newsletter.' }

  const prefs = normalizeNewsletterPreferences(preferences)
  const prefsJson = JSON.stringify(prefs)
  const token = tokenFromEmail(em) + randomBytes(4).toString('hex')
  const now = new Date().toISOString()
  const id = randomUUID()

  try {
    const existing = await query(`SELECT * FROM newsletter_subscribers WHERE email = $1`, [em])
    if (existing.rows[0]) {
      const row = existing.rows[0]
      const unsubscribed = Boolean(row.unsubscribed_at)
      if (unsubscribed && !resubscribe) {
        return { ok: false, error: 'This email has unsubscribed. Use the preferences link to re-subscribe.' }
      }
      await query(
        `UPDATE newsletter_subscribers
         SET unsubscribed_at = NULL, source = COALESCE($2, source), preferences_json = $3,
             unsubscribe_token = COALESCE(unsubscribe_token, $4)
         WHERE email = $1`,
        [em, source || null, prefsJson, token],
      )
    } else {
      await query(
        `INSERT INTO newsletter_subscribers (id, email, source, subscribed_at, unsubscribe_token, preferences_json)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, em, source, now, token, prefsJson],
      )
    }

    const updated = await query(`SELECT * FROM newsletter_subscribers WHERE email = $1`, [em])
    const sub = mapSubscriberRow(updated.rows[0])
    const urls = buildNewsletterManageUrls(sub.unsubscribeToken)
    return { ok: true, email: em, subscriber: sub, ...urls }
  } catch (e) {
    console.error(e)
    return { ok: false, error: 'Could not subscribe to newsletter.' }
  }
}

export async function getSubscriberByToken(token) {
  await ensureNewsletterSchema()
  const t = String(token || '').trim()
  if (!t) return null
  const r = await query(`SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = $1`, [t])
  return mapSubscriberRow(r.rows[0])
}

/** Return unsubscribe/preferences token for an email, creating a subscriber row if needed. */
export async function ensureNewsletterSubscriberToken(email) {
  await ensureNewsletterSchema()
  const em = String(email || '')
    .trim()
    .toLowerCase()
  if (!em.includes('@')) return null
  const existing = await query(`SELECT unsubscribe_token FROM newsletter_subscribers WHERE email = $1`, [em])
  let token = existing.rows[0]?.unsubscribe_token
  if (token) return token
  const sub = await subscribeNewsletter(em, { source: NEWSLETTER_SOURCES.account_settings, resubscribe: true })
  if (!sub.ok) return null
  const again = await query(`SELECT unsubscribe_token FROM newsletter_subscribers WHERE email = $1`, [em])
  return again.rows[0]?.unsubscribe_token || null
}

export async function unsubscribeByToken(token) {
  const sub = await getSubscriberByToken(token)
  if (!sub) return { ok: false, error: 'Invalid or expired link.' }
  if (!sub.active) return { ok: true, email: sub.email, already: true }
  const now = new Date().toISOString()
  await query(`UPDATE newsletter_subscribers SET unsubscribed_at = $1 WHERE unsubscribe_token = $2`, [now, token])
  return { ok: true, email: sub.email }
}

export async function updateSubscriberPreferences(token, preferences) {
  const sub = await getSubscriberByToken(token)
  if (!sub) return { ok: false, error: 'Invalid or expired link.' }
  const prefs = normalizeNewsletterPreferences(preferences)
  const prefsJson = JSON.stringify(prefs)
  const now = new Date().toISOString()
  await query(
    `UPDATE newsletter_subscribers
     SET preferences_json = $1, unsubscribed_at = NULL, subscribed_at = COALESCE(subscribed_at, $2)
     WHERE unsubscribe_token = $3`,
    [prefsJson, now, token],
  )
  const updated = await getSubscriberByToken(token)
  return { ok: true, subscriber: updated }
}

export async function listNewsletterSubscribers(url) {
  await ensureNewsletterSchema()
  const { q, page, pageSize, offset } = parseAdminListQuery(url)
  const status = (url.searchParams.get('status') || 'active').trim().toLowerCase()

  let where = 'WHERE 1=1'
  const params = []
  if (status === 'active') where += ` AND unsubscribed_at IS NULL`
  else if (status === 'unsubscribed') where += ` AND unsubscribed_at IS NOT NULL`
  if (q) {
    params.push(`%${q}%`)
    where += ` AND ${emailLikeClause(params.length)}`
  }

  const countSql = dbIsPostgres()
    ? `SELECT COUNT(*)::int AS c FROM newsletter_subscribers ${where}`
    : `SELECT COUNT(*) AS c FROM newsletter_subscribers ${where}`
  const countRes = await query(countSql, params)
  const total = Number(countRes.rows[0]?.c ?? 0)

  const listParams = [...params, pageSize, offset]
  const r = await query(
    `SELECT * FROM newsletter_subscribers ${where}
     ORDER BY subscribed_at DESC
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams,
  )

  return {
    rows: r.rows.map(mapSubscriberRow),
    ...adminListMeta(total, page, pageSize),
  }
}

export async function exportNewsletterSubscribersCsv({ status = 'active' } = {}) {
  await ensureNewsletterSchema()
  let where = 'WHERE 1=1'
  if (status === 'active') where += ` AND unsubscribed_at IS NULL`
  else if (status === 'unsubscribed') where += ` AND unsubscribed_at IS NOT NULL`
  const r = await query(
    `SELECT email, source, subscribed_at, unsubscribed_at, preferences_json
     FROM newsletter_subscribers ${where}
     ORDER BY subscribed_at DESC`,
  )
  const header = 'email,source,subscribed_at,unsubscribed_at,giveaway_updates,competition_news,promotions'
  const lines = [header]
  for (const row of r.rows) {
    const prefs = normalizeNewsletterPreferences(
      typeof row.preferences_json === 'string' ? JSON.parse(row.preferences_json || '{}') : row.preferences_json,
    )
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    lines.push(
      [
        esc(row.email),
        esc(row.source),
        esc(row.subscribed_at),
        esc(row.unsubscribed_at || ''),
        prefs.giveawayUpdates ? 'yes' : 'no',
        prefs.competitionNews ? 'yes' : 'no',
        prefs.promotions ? 'yes' : 'no',
      ].join(','),
    )
  }
  return lines.join('\n')
}

export async function sendWelcomeEmail({ to, unsubscribeToken }) {
  const apiKey = getResendApiKey()
  if (!apiKey) return { ok: false, skipped: true, reason: 'no_resend_key' }
  const { preferencesUrl, unsubscribeUrl } = buildNewsletterManageUrls(unsubscribeToken)
  const siteUrl = resolvePublicSiteUrlForEmail(resolveSiteUrl()).replace(/\/$/, '')
  const layout = await getSitePageLayout(EMAIL_LAYOUT_PAGE_ID)
  const urls = { siteUrl, preferencesUrl, unsubscribeUrl }
  const html = buildWelcomeEmailHtml(layout, urls)
  const text = buildWelcomeEmailText(layout, urls)
  const subject = welcomeEmailSubject(layout)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: resolveResendFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: formatResendError(data, res.status) }
  }
  return { ok: true, id: data.id }
}

export async function sendNewsletterCampaign({ subject, bodyHtml, imageUrls, campaignImages, createdBy, testEmail }) {
  await ensureNewsletterSchema()
  const apiKey = getResendApiKey()
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY is not set — cannot send campaigns.' }
  }

  const layout = await getSitePageLayout(EMAIL_LAYOUT_PAGE_ID)
  const subj = String(subject || '').trim().slice(0, 200) || campaignDefaultSubject(layout)
  const htmlBody = String(bodyHtml || '').trim()
  if (!subj || !htmlBody) return { ok: false, error: 'Subject and inner content are required.' }
  const siteUrl = resolvePublicSiteUrlForEmail(resolveSiteUrl()).replace(/\/$/, '')
  const { campaignImages: resolvedImages, attachments: campaignAttachments } = await resolveCampaignEmailImages(
    campaignImages ?? imageUrls,
  )

  const campaignId = randomUUID()
  const now = new Date().toISOString()

  let recipients = []
  if (testEmail) {
    const em = String(testEmail).trim().toLowerCase()
    if (!em.includes('@')) return { ok: false, error: 'Valid test email required.' }
    recipients = [{ email: em, unsubscribe_token: tokenFromEmail(em) }]
  } else {
    const r = await query(
      `SELECT email, unsubscribe_token FROM newsletter_subscribers
       WHERE unsubscribed_at IS NULL
       ORDER BY subscribed_at DESC
       LIMIT 2000`,
    )
    recipients = r.rows
  }

  let sent = 0
  let skipped = 0
  const errors = []

  for (const row of recipients) {
    const em = String(row.email || '').trim()
    if (!em.includes('@')) {
      skipped += 1
      continue
    }
    const { preferencesUrl, unsubscribeUrl } = buildNewsletterManageUrls(row.unsubscribe_token)
    const html = buildCampaignEmailHtml(layout, {
      siteUrl,
      bodyHtml: htmlBody,
      campaignImages: resolvedImages,
      preferencesUrl,
      unsubscribeUrl,
    })
    const text = buildCampaignEmailText(layout, {
      bodyHtml: htmlBody,
      campaignImages: resolvedImages,
      preferencesUrl,
      unsubscribeUrl,
    })
    const payload = {
      from: resolveResendFrom(),
      to: [em],
      subject: subj,
      html,
      text,
    }
    if (campaignAttachments.length) payload.attachments = campaignAttachments
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      sent += 1
    } else {
      skipped += 1
      if (errors.length < 5) errors.push(`${em}: ${formatResendError(data, res.status)}`)
      if (!isResendProductionMode() && res.status === 403) break
    }
    await new Promise((r) => setTimeout(r, 120))
  }

  if (!testEmail) {
    await query(
      `INSERT INTO newsletter_campaigns (id, subject, body_html, sent_count, skipped_count, created_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [campaignId, subj, htmlBody, sent, skipped, now, createdBy || null],
    )
  }

  return {
    ok: sent > 0 || testEmail,
    sent,
    skipped,
    total: recipients.length,
    testMode: Boolean(testEmail),
    emailTemplate: 'campaign-v2',
    errors,
    sandboxNote: !isResendProductionMode()
      ? 'Local dev uses Resend test sender — only your Resend account email can receive mail. Set RESEND_USE_VERIFIED_DOMAIN=1 in .env.local to send from showskills.co.uk locally.'
      : null,
  }
}

export async function maybeSubscribeFromPaidPurchase(email, newsletterOptIn) {
  if (newsletterOptIn !== true && newsletterOptIn !== 'true' && newsletterOptIn !== 1) return { ok: true, skipped: true }
  return subscribeNewsletter(email, { source: 'paid_competition' })
}
