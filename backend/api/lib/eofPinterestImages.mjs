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
  if (!res.ok) return null

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

/**
 * Search Pinterest partner API (requires approved app + access token).
 * Prefers pins whose title/description match the topic, then newest.
 * @param {string} query
 * @param {number} index
 * @param {string} token
 * @param {{ topic?: string }} [opts]
 */
export async function searchPinterestPartnerPins(query, index, token, opts = {}) {
  const country = (process.env.EOF_PINTEREST_COUNTRY || process.env.PINTEREST_COUNTRY || 'GB').trim()
  const searchUrl = new URL('https://api.pinterest.com/v5/search/partner/pins')
  searchUrl.searchParams.set('term', query)
  searchUrl.searchParams.set('country_code', country)
  searchUrl.searchParams.set('page_size', '25')

  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null

  const data = await res.json()
  const items = data.items || []
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
  const images = pin?.media?.images || pin?.images || {}
  const imgUrl = pickLargestPinterestImage(images) || pin?.image_url || pin?.media?.image_url
  if (!imgUrl) return null

  return {
    imgUrl: upscalePinterestImageUrl(imgUrl),
    pinId: pin.id || pin.pin_id || null,
    title: pin.title || pin.description || null,
    queryUsed: query,
    relevance: scoreImageRelevance(opts.topic || query, pin.title || pin.description || ''),
  }
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

export function isEofPinterestApiConfigured() {
  return Boolean((process.env.PINTEREST_ACCESS_TOKEN || process.env.EOF_PINTEREST_ACCESS_TOKEN || '').trim())
}
