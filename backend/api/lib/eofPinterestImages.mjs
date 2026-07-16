import { scoreImageRelevance } from '../../../shared/eofSceneImageQueries.mjs'

const PIN_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?(?:[a-z]{2,}\.)?pinterest\.(?:com|co\.uk|fr|de|it|es|ca|com\.au)\/pin\/[\w-]+|(?:https?:\/\/)?pin\.it\/[\w]+/i

export function isPinterestPinUrl(value) {
  return PIN_URL_RE.test(String(value || '').trim())
}

function normalizePinUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw
  return `https://${raw}`
}

/** Prefer largest pinimg CDN size for Shorts. */
export function upscalePinterestImageUrl(url) {
  const u = String(url || '')
  if (!u.includes('pinimg.com')) return u
  if (u.includes('/originals/')) return u
  return u
    .replace(/\/\d+x\d+\//, '/1200x/')
    .replace(/\/\d+x\//, '/1200x/')
}

/**
 * Fetch image from a public Pinterest pin URL (no API key — uses oEmbed).
 * @param {string} pinUrl
 */
export async function fetchPinterestPinImage(pinUrl) {
  const url = normalizePinUrl(pinUrl)
  if (!isPinterestPinUrl(url)) return null

  const oembedUrl = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`
  const res = await fetch(oembedUrl, {
    headers: { Accept: 'application/json', 'User-Agent': 'ShowSkills-EOF/1.0' },
  })
  if (!res.ok) {
    console.warn('[eof-pinterest] oEmbed failed', res.status, url)
    return null
  }

  const data = await res.json()
  const thumb = data?.thumbnail_url
  if (!thumb) return null

  return {
    imgUrl: upscalePinterestImageUrl(thumb),
    title: data.title || null,
    authorName: data.author_name || null,
    queryUsed: url,
  }
}

function pinCreatedMs(pin) {
  const raw =
    pin?.created_at ||
    pin?.createdAt ||
    pin?.board?.created_at ||
    pin?.pin_metrics?.impression ||
    null
  if (!raw) return 0
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : 0
}

function rankPinterestPins(items, topic, query) {
  const hayTopic = `${topic || ''} ${query || ''}`.trim()
  return [...items]
    .map((pin, idx) => {
      const title = String(pin?.title || pin?.description || pin?.alt_text || '')
      const relevance = scoreImageRelevance(hayTopic, title)
      const created = pinCreatedMs(pin)
      return { pin, idx, relevance, created }
    })
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance
      if (b.created !== a.created) return b.created - a.created
      return a.idx - b.idx
    })
    .map((row) => row.pin)
}

function pickLargestPinterestImage(images) {
  if (!images || typeof images !== 'object') return null
  const order = ['1200x', '600x', '400x300', '564x', '236x', '170x', '150x150']
  for (const key of order) {
    const hit = images[key]?.url || images[key]
    if (typeof hit === 'string' && hit.startsWith('http')) return hit
  }
  const values = Object.values(images)
  for (const entry of values) {
    const url = entry?.url || entry
    if (typeof url === 'string' && url.startsWith('http')) return url
  }
  return null
}

function pinToHit(pin, query, topic) {
  if (!pin) return null
  const images = pin?.media?.images || pin?.images || {}
  const imgUrl = pickLargestPinterestImage(images) || pin?.image_url || pin?.media?.image_url
  if (!imgUrl) return null
  const title = pin.title || pin.description || pin.alt_text || null
  return {
    imgUrl: upscalePinterestImageUrl(imgUrl),
    pinId: pin.id || pin.pin_id || null,
    title,
    queryUsed: query,
    relevance: scoreImageRelevance(topic || query, title || ''),
  }
}

/**
 * GET /v5/search/partner/pins — catalog search (beta; needs approved app).
 * Uses `limit` (1–50), NOT page_size.
 */
async function searchPartnerPins(query, token, country) {
  const searchUrl = new URL('https://api.pinterest.com/v5/search/partner/pins')
  searchUrl.searchParams.set('term', query)
  searchUrl.searchParams.set('country_code', country)
  searchUrl.searchParams.set('limit', '25')

  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const bodyText = await res.text().catch(() => '')
  let data = {}
  try {
    data = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    console.warn(
      '[eof-pinterest] partner search failed',
      res.status,
      bodyText.slice(0, 220) || res.statusText,
    )
    return { ok: false, status: res.status, items: [], error: bodyText.slice(0, 220) }
  }
  return { ok: true, status: res.status, items: Array.isArray(data.items) ? data.items : [] }
}

/**
 * GET /v5/search/pins — search pins on the token's own account (always available with pins:read).
 * Weaker than partner catalog, but a usable fallback when partner search is not approved.
 */
async function searchUserPins(query, token) {
  const searchUrl = new URL('https://api.pinterest.com/v5/search/pins')
  searchUrl.searchParams.set('query', query)
  searchUrl.searchParams.set('page_size', '25')

  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const bodyText = await res.text().catch(() => '')
  let data = {}
  try {
    data = bodyText ? JSON.parse(bodyText) : {}
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    console.warn(
      '[eof-pinterest] user-pin search failed',
      res.status,
      bodyText.slice(0, 220) || res.statusText,
    )
    return { ok: false, status: res.status, items: [], error: bodyText.slice(0, 220) }
  }
  return { ok: true, status: res.status, items: Array.isArray(data.items) ? data.items : [] }
}

/**
 * Search Pinterest for topic photos.
 * Tries partner catalog first (best), then the token account's pins as fallback.
 * Prefers pins whose title/description match the topic, then newest.
 * @param {string} query
 * @param {number} index
 * @param {string} token
 * @param {{ topic?: string }} [opts]
 */
export async function searchPinterestPartnerPins(query, index, token, opts = {}) {
  if (!token || !String(query || '').trim()) return null

  const country = (process.env.EOF_PINTEREST_COUNTRY || process.env.PINTEREST_COUNTRY || 'GB')
    .trim()
    .toUpperCase()
    .slice(0, 2) || 'GB'

  let items = []
  const partner = await searchPartnerPins(query, token, country)
  if (partner.ok && partner.items.length) {
    items = partner.items
  } else {
    // Partner search is beta / app-approved only — fall back to the account's own pins.
    if (partner.status === 401 || partner.status === 403) {
      console.warn(
        '[eof-pinterest] partner search unauthorized — check token scopes / partner access; trying account pin search',
      )
    }
    const own = await searchUserPins(query, token)
    if (own.ok && own.items.length) {
      items = own.items
      console.info('[eof-pinterest] using account pin search fallback', items.length, 'hits for', query)
    }
  }

  if (!items.length) return null

  const ranked = rankPinterestPins(items, opts.topic || query, query)
  // Require a stronger name match — Pinterest is full of old/meme pins
  const minScore = scoreImageRelevance(opts.topic || query, opts.topic || query) > 0 ? 6 : 0
  const relevant = ranked.filter((pin) => {
    const title = String(pin?.title || pin?.description || pin?.alt_text || '')
    return scoreImageRelevance(opts.topic || query, title) >= minScore
  })
  // Never fall back to irrelevant pins when we have a person/topic name
  if (!relevant.length && minScore > 0) return null
  const pool = relevant.length ? relevant : ranked
  const pin = pool[Math.max(0, index) % pool.length]
  return pinToHit(pin, query, opts.topic || query)
}

export function getEofPinterestAccessToken() {
  return (process.env.PINTEREST_ACCESS_TOKEN || process.env.EOF_PINTEREST_ACCESS_TOKEN || '').trim()
}

export function isEofPinterestApiConfigured() {
  return Boolean(getEofPinterestAccessToken())
}

/**
 * Lightweight token check for Production UI diagnostics (does not search).
 * @returns {Promise<{ configured: boolean, ok: boolean, status?: number, detail?: string }>}
 */
export async function probeEofPinterestApi() {
  const token = getEofPinterestAccessToken()
  if (!token) return { configured: false, ok: false, detail: 'PINTEREST_ACCESS_TOKEN not set' }
  try {
    const res = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return {
        configured: true,
        ok: false,
        status: res.status,
        detail: body.slice(0, 160) || res.statusText,
      }
    }
    return { configured: true, ok: true, status: res.status }
  } catch (e) {
    return {
      configured: true,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}
