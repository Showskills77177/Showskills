/**
 * Associated Press Media API — editorial picture search + download for EOF Shorts.
 *
 * Docs: https://developer.ap.org/ap-media-api
 * Auth: x-api-key header (never call AP from the browser).
 *
 * Env:
 *   AP_MEDIA_API_KEY / EOF_AP_MEDIA_API_KEY / AP_API_KEY
 *   EOF_AP_IN_MY_PLAN=1     (default) only return items already in your AP plan
 *   EOF_AP_PREFER_PREVIEW=1 (default) prefer preview JPG over full main when available
 */
import { scoreImageRelevance } from '../../../shared/eofSceneImageQueries.mjs'

function envKey(...names) {
  for (const n of names) {
    const v = String(process.env[n] || '').trim()
    if (v) return v
  }
  return ''
}

export function getApMediaApiKey() {
  return envKey('AP_MEDIA_API_KEY', 'EOF_AP_MEDIA_API_KEY', 'AP_API_KEY')
}

export function isEofApImagesConfigured() {
  return Boolean(getApMediaApiKey())
}

function apHeaders(key = getApMediaApiKey()) {
  return {
    'x-api-key': key,
    Accept: 'application/json',
    'User-Agent': 'ShowSkillsEOF/1.0 (https://showskills.co.uk; eof-production@showskills.co.uk)',
  }
}

function looksLikeImageBuffer(buf) {
  if (!buf || buf.length < 24) return false
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  return false
}

/** Escape user text for AP boolean query syntax. */
function sanitizeApQueryTerm(raw) {
  return String(raw || '')
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

/**
 * Build an AP search expression for football pictures.
 * @param {string} query
 */
export function buildApPictureSearchQuery(query) {
  const term = sanitizeApQueryTerm(query)
  if (!term) return 'type:picture AND (football OR soccer)'
  // Prefer photos; keep soccer as AP metadata synonym for football worldwide
  return `type:picture AND (${term}) AND (football OR soccer OR "World Cup" OR Premier OR LaLiga OR Serie OR Bundesliga OR Champions)`
}

function collectRenditions(item) {
  const renditions = item?.renditions || item?.item?.renditions || {}
  const list = []
  for (const [role, r] of Object.entries(renditions)) {
    if (!r || typeof r !== 'object') continue
    const href = String(r.href || '').trim()
    if (!href) continue
    const mime = String(r.mimetype || r.contenttype || '').toLowerCase()
    const isImage =
      mime.startsWith('image/') ||
      /\.(jpe?g|png|webp)(\?|$)/i.test(href) ||
      /role=(main|preview|thumbnail|web)/i.test(href)
    if (!isImage && mime && !mime.includes('octet')) continue
    list.push({
      role: String(role || r.rel || 'main').toLowerCase(),
      href,
      width: Number(r.width) || 0,
      height: Number(r.height) || 0,
      mime,
      priced: String(r.priced || '').toLowerCase() === 'true',
      pricetag: r.pricetag ? String(r.pricetag) : '',
      title: r.title || role,
    })
  }
  return list
}

function pickRendition(renditions, { preferPreview = true } = {}) {
  if (!renditions.length) return null
  const score = (r) => {
    let s = 0
    if (/jpe?g|png|webp/i.test(r.mime || r.href)) s += 20
    if (preferPreview && /preview|web|medium/i.test(r.role)) s += 50
    if (!preferPreview && /main|original|high/i.test(r.role)) s += 50
    if (/main/i.test(r.role)) s += 15
    if (/preview/i.test(r.role)) s += 10
    if (/thumbnail|thumb/i.test(r.role)) s -= 40
    const area = (r.width || 800) * (r.height || 800)
    if (area >= 800 * 1200) s += 10
    if (area >= 1080 * 1080) s += 10
    if (r.priced) s -= 5
    return s
  }
  return [...renditions].sort((a, b) => score(b) - score(a))[0] || null
}

function extractItems(payload) {
  const items = payload?.data?.items || payload?.items || []
  return Array.isArray(items) ? items : []
}

function itemMeta(entry) {
  const item = entry?.item || entry
  const title =
    item?.headline ||
    item?.title ||
    item?.description_caption ||
    item?.description ||
    entry?.meta?.title ||
    null
  const id = item?.altids?.itemid || item?.uri || item?.id || entry?.meta?.id || null
  return { item, title: title ? String(title).slice(0, 160) : null, id: id ? String(id) : null }
}

/**
 * Search AP Media for a picture matching the scene query.
 * Newest first (versioncreated:desc), then topic-relevance ranked.
 * @returns {Promise<null | { href: string, pricetag?: string, title?: string, apItemId?: string, role?: string, queryUsed: string, relevance?: number }>}
 */
export async function searchApMediaPicture(query, index = 0, opts = {}) {
  const key = getApMediaApiKey()
  if (!key) return null

  const q = buildApPictureSearchQuery(query)
  const inMyPlan = String(process.env.EOF_AP_IN_MY_PLAN || '1').trim() !== '0'
  const preferPreview = String(process.env.EOF_AP_PREFER_PREVIEW || '1').trim() !== '0'
  const pageSize = 15
  const page = Math.floor(Math.max(0, index) / pageSize) + 1
  const topic = String(opts.topic || query || '').trim()

  const url = new URL('https://api.ap.org/media/v/content/search')
  url.searchParams.set('q', q)
  url.searchParams.set('page_size', String(pageSize))
  url.searchParams.set('page', String(page))
  url.searchParams.set('include', '*')
  url.searchParams.set('sort', 'versioncreated:desc')
  if (inMyPlan) url.searchParams.set('in_my_plan', 'true')

  const res = await fetch(url.toString(), {
    headers: apHeaders(key),
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AP Media search ${res.status}: ${body.slice(0, 180)}`)
  }
  const data = await res.json()
  const items = extractItems(data)
  if (!items.length) return null

  const ranked = items
    .map((entry, idx) => {
      const meta = itemMeta(entry)
      const relevance = scoreImageRelevance(topic, meta.title || '')
      return { entry, idx, relevance, ...meta }
    })
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance
      return a.idx - b.idx
    })

  const minScore = scoreImageRelevance(topic, topic) > 0 ? 4 : 0
  const pool = ranked.filter((r) => r.relevance >= minScore)
  const use = pool.length ? pool : ranked
  const pickRow = use[Math.max(0, index) % use.length]
  if (!pickRow) return null

  const { item, title, id, relevance } = pickRow
  const rendition = pickRendition(collectRenditions(item), { preferPreview })
  if (!rendition?.href) return null

  return {
    href: rendition.href,
    pricetag: rendition.pricetag || '',
    priced: rendition.priced,
    role: rendition.role,
    title,
    apItemId: id,
    queryUsed: query,
    relevance,
  }
}

/**
 * Download an AP rendition href (with API key + optional pricetag) to disk.
 */
export async function downloadApRenditionToFile(hit, outPath) {
  const key = getApMediaApiKey()
  if (!key || !hit?.href) return false

  let href = String(hit.href)
  if (hit.pricetag) {
    const u = new URL(href)
    if (!u.searchParams.get('pricetag')) u.searchParams.set('pricetag', hit.pricetag)
    href = u.toString()
  }

  const res = await fetch(href, {
    headers: {
      'x-api-key': key,
      Accept: 'image/*,*/*',
      'User-Agent': 'ShowSkillsEOF/1.0 (https://showskills.co.uk; eof-production@showskills.co.uk)',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) {
    console.warn('[eof-ap-images] download failed', res.status, href.slice(0, 120))
    return false
  }
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 8_000 || !looksLikeImageBuffer(buf)) return false
  const { writeFile } = await import('node:fs/promises')
  await writeFile(outPath, buf)
  return true
}
