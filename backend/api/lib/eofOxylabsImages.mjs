/**
 * Oxylabs Realtime API — Google Images search for EOF Shorts scene photos.
 *
 * Docs: https://developers.oxylabs.io/api-targets/search-engines/google/search/image-search
 * Auth: Basic Auth (OXYLABS_USERNAME / OXYLABS_PASSWORD). Never log credentials.
 *
 * Env:
 *   OXYLABS_USERNAME
 *   OXYLABS_PASSWORD
 *   OXYLABS_GEO_LOCATION   (optional, default "United States")
 */

const OXYLABS_REALTIME_URL = 'https://realtime.oxylabs.io/v1/queries'
const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_LIMIT = 12

function envTrim(name) {
  return String(process.env[name] || '').trim()
}

export function getOxylabsCredentials() {
  const username = envTrim('OXYLABS_USERNAME')
  const password = envTrim('OXYLABS_PASSWORD')
  if (!username || !password) return null
  return { username, password }
}

export function isEofOxylabsConfigured() {
  return Boolean(getOxylabsCredentials())
}

function oxylabsGeoLocation() {
  return envTrim('OXYLABS_GEO_LOCATION') || 'United States'
}

function basicAuthHeader(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`, 'utf8').toString('base64')}`
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/** Prefer direct image hosts; demote tiny/junk gstatic thumbs. */
function scoreImageCandidate(url, width = 0, height = 0) {
  const u = String(url || '').toLowerCase()
  let s = 0
  if (!isHttpUrl(url)) return -100
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) s += 25
  if (/encrypted-tbn\d*\.gstatic\.com/i.test(u)) s -= 15
  if (/gstatic\.com\/images/i.test(u) && /[?&]s=\d{1,2}(?:&|$)/i.test(u)) s -= 40
  if (/favicon|sprite|logo\.svg|1x1|pixel/i.test(u)) s -= 80
  const area = (Number(width) || 0) * (Number(height) || 0)
  if (area >= 800 * 800) s += 20
  else if (area >= 400 * 400) s += 10
  else if (area > 0 && area < 120 * 120) s -= 30
  return s
}

function pickUrlFromOrganicItem(item) {
  if (!item || typeof item !== 'object') return null
  // Prefer full-size when Oxylabs provides it (common key: high_res_image).
  const candidates = [
    item.high_res_image,
    item.highResImage,
    item.original,
    item.original_image,
    item.originalImage,
    item.img_url,
    item.imgUrl,
    item.image_src,
    item.imageSrc,
    item.src,
    item.url,
    item.image,
    item.thumbnail,
    item.thumb,
  ]
  let best = null
  let bestScore = -Infinity
  for (const raw of candidates) {
    if (!isHttpUrl(raw)) continue
    const url = String(raw).trim()
    const w = Number(item.width || item.img_width || item.image_width || 0) || 0
    const h = Number(item.height || item.img_height || item.image_height || 0) || 0
    const score = scoreImageCandidate(url, w, h)
    if (score > bestScore) {
      bestScore = score
      best = { url, width: w || undefined, height: h || undefined, title: item.title || null }
    }
  }
  if (!best || bestScore < -50) return null
  return best
}

/**
 * Walk Oxylabs realtime response and collect organic/image rows.
 * Shape varies: results[].content.results.organic | results.images | images.items
 */
export function extractOxylabsImageRows(payload) {
  const rows = []
  const seen = new Set()

  const pushItem = (item) => {
    const picked = pickUrlFromOrganicItem(item)
    if (!picked) return
    if (seen.has(picked.url)) return
    seen.add(picked.url)
    rows.push(picked)
  }

  const walk = (node, depth = 0) => {
    if (!node || depth > 8) return
    if (Array.isArray(node)) {
      for (const el of node) walk(el, depth + 1)
      return
    }
    if (typeof node !== 'object') return

    const organic = node.organic
    if (Array.isArray(organic)) {
      for (const item of organic) pushItem(item)
    }

    const images = node.images
    if (Array.isArray(images)) {
      for (const item of images) pushItem(item)
    } else if (images && typeof images === 'object' && Array.isArray(images.items)) {
      for (const item of images.items) pushItem(item)
    }

    if (node.content) walk(node.content, depth + 1)
    if (node.results) walk(node.results, depth + 1)
    if (Array.isArray(node.results)) walk(node.results, depth + 1)
  }

  walk(payload)
  rows.sort(
    (a, b) => scoreImageCandidate(b.url, b.width, b.height) - scoreImageCandidate(a.url, a.width, a.height),
  )
  return rows
}

/**
 * Search Google Images via Oxylabs realtime API.
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<Array<{ url: string, width?: number, height?: number, title?: string|null, source: 'oxylabs' }>>}
 */
export async function searchOxylabsGoogleImages(query, opts = {}) {
  const creds = getOxylabsCredentials()
  if (!creds) return []

  const q = String(query || '').trim()
  if (!q) return []

  const limit = Math.max(1, Math.min(40, Number(opts.limit) || DEFAULT_LIMIT))
  const timeoutMs = Math.max(5_000, Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS)

  const controller = new AbortController()
  const external = opts.signal
  const onAbort = () => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onAbort, { once: true })
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(OXYLABS_REALTIME_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuthHeader(creds.username, creds.password),
        Accept: 'application/json',
      },
      body: JSON.stringify({
        source: 'google_search',
        query: q,
        geo_location: oxylabsGeoLocation(),
        parse: true,
        context: [{ key: 'tbm', value: 'isch' }],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // Never include auth material; body slice only.
      console.warn('[eof-oxylabs] search failed', res.status, body.slice(0, 180))
      return []
    }

    const data = await res.json()
    const rows = extractOxylabsImageRows(data)
    rows.sort((a, b) => scoreImageCandidate(b.url, b.width, b.height) - scoreImageCandidate(a.url, a.width, a.height))

    return rows.slice(0, limit).map((r) => ({
      url: r.url,
      width: r.width,
      height: r.height,
      title: r.title || null,
      source: 'oxylabs',
    }))
  } catch (e) {
    if (e?.name === 'AbortError') {
      console.warn('[eof-oxylabs] search timed out or aborted')
    } else {
      console.warn('[eof-oxylabs] search error', e instanceof Error ? e.message : e)
    }
    return []
  } finally {
    clearTimeout(timer)
    if (external) external.removeEventListener('abort', onAbort)
  }
}

/**
 * Pick one image for a scene index (rotation-friendly), with title for relevance scoring.
 * @param {string} query
 * @param {number} index
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function searchOxylabsGoogleImage(query, index = 0, opts = {}) {
  const hits = await searchOxylabsGoogleImages(query, { limit: 20, signal: opts.signal })
  if (!hits.length) return null
  const pick = Math.max(0, Number(index) || 0) % hits.length
  const ordered = [...hits.slice(pick), ...hits.slice(0, pick)]
  const hit = ordered[0]
  if (!hit) return null
  return {
    imgUrl: hit.url,
    title: hit.title || null,
    width: hit.width,
    height: hit.height,
    queryUsed: query,
    source: 'oxylabs',
  }
}

/**
 * Lightweight status for Production UI.
 * Does not call Oxylabs (realtime queries are billable) — only checks env presence.
 * @returns {Promise<{ configured: boolean, ok: boolean, detail?: string }>}
 */
export async function probeEofOxylabsApi() {
  const creds = getOxylabsCredentials()
  if (!creds) return { configured: false, ok: false, detail: 'OXYLABS_USERNAME / OXYLABS_PASSWORD not set' }
  return { configured: true, ok: true, detail: 'credentials set (Google Images via realtime API)' }
}
