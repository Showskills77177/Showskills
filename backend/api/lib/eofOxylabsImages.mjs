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
  const username = envTrim('OXYLABS_USERNAME') || envTrim('OXYLABS_USER')
  const password = envTrim('OXYLABS_PASSWORD') || envTrim('OXYLABS_PASS')
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
      // Docs prefer udm=2 for Image Search; tbm=isch is the legacy equivalent.
      body: JSON.stringify({
        source: 'google_search',
        query: q,
        geo_location: oxylabsGeoLocation(),
        parse: true,
        context: [{ key: 'udm', value: 2 }],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // Never include auth material; body slice only.
      if (res.status === 401 || res.status === 403) {
        console.warn(
          '[eof-oxylabs] auth failed',
          res.status,
          '— OXYLABS_PASSWORD on Vercel does not match the Oxylabs dashboard user (username may still be correct).',
        )
      } else {
        console.warn('[eof-oxylabs] search failed', res.status, body.slice(0, 180))
      }
      return []
    }

    const data = await res.json()
    const rows = extractOxylabsImageRows(data)
    console.info('[eof-oxylabs] google images', q.slice(0, 60), '→', rows.length, 'urls')
    if (!rows.length) {
      console.warn(
        '[eof-oxylabs] parsed 0 image URLs — check response shape / high_res_image fields for',
        q.slice(0, 60),
      )
    }

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
 * Rotate the SERP list so rebuild `attempt` / scene index lands on a different start slot.
 * @param {Array<{ url: string, width?: number, height?: number, title?: string|null }>} hits
 * @param {number} [index]
 */
export function orderOxylabsHitsForRotation(hits, index = 0) {
  if (!Array.isArray(hits) || !hits.length) return []
  const pick = Math.max(0, Number(index) || 0) % hits.length
  return [...hits.slice(pick), ...hits.slice(0, pick)]
}

/**
 * Pick the next unused Oxylabs hit from a single SERP pool (no extra API calls).
 * Skips URLs in `avoidUrls` / `oxylabs:` keys; falls back to the first avoided hit only
 * when every candidate was already used (so rebuilds never return empty when SERP has rows).
 *
 * @param {Array<{ url: string, width?: number, height?: number, title?: string|null }>} hits
 * @param {{ index?: number, avoidUrls?: Iterable<string> }} [opts]
 * @returns {{ imgUrl: string, title: string|null, width?: number, height?: number, reused: boolean } | null}
 */
export function pickOxylabsImageFromHits(hits, opts = {}) {
  const ordered = orderOxylabsHitsForRotation(hits, opts.index)
  if (!ordered.length) return null

  const avoid = new Set()
  for (const raw of opts.avoidUrls || []) {
    const k = String(raw || '').trim()
    if (!k) continue
    avoid.add(k)
    if (k.startsWith('oxylabs:')) avoid.add(k.slice('oxylabs:'.length))
    else avoid.add(`oxylabs:${k}`)
  }

  let fallback = null
  for (const hit of ordered) {
    const url = String(hit?.url || '').trim()
    if (!url) continue
    const reused = avoid.has(url) || avoid.has(`oxylabs:${url}`)
    if (reused) {
      if (!fallback) fallback = hit
      continue
    }
    return {
      imgUrl: url,
      title: hit.title || null,
      width: hit.width,
      height: hit.height,
      reused: false,
    }
  }
  if (!fallback?.url) return null
  return {
    imgUrl: String(fallback.url).trim(),
    title: fallback.title || null,
    width: fallback.width,
    height: fallback.height,
    reused: true,
  }
}

/**
 * Enumerate Oxylabs hits for download attempts: fresh URLs first (rotated), then avoided as last resort.
 * @param {Array<{ url: string, width?: number, height?: number, title?: string|null }>} hits
 * @param {{ index?: number, avoidUrls?: Iterable<string> }} [opts]
 * @returns {Array<{ imgUrl: string, title: string|null, width?: number, height?: number, reused: boolean }>}
 */
export function listOxylabsImageCandidates(hits, opts = {}) {
  const ordered = orderOxylabsHitsForRotation(hits, opts.index)
  if (!ordered.length) return []

  const avoid = new Set()
  for (const raw of opts.avoidUrls || []) {
    const k = String(raw || '').trim()
    if (!k) continue
    avoid.add(k)
    if (k.startsWith('oxylabs:')) avoid.add(k.slice('oxylabs:'.length))
    else avoid.add(`oxylabs:${k}`)
  }

  const fresh = []
  const reused = []
  for (const hit of ordered) {
    const url = String(hit?.url || '').trim()
    if (!url) continue
    const row = {
      imgUrl: url,
      title: hit.title || null,
      width: hit.width,
      height: hit.height,
      reused: avoid.has(url) || avoid.has(`oxylabs:${url}`),
    }
    if (row.reused) reused.push(row)
    else fresh.push(row)
  }
  return [...fresh, ...reused]
}

/**
 * Pick one image for a scene index (rotation-friendly), with title for relevance scoring.
 * One billable SERP call; walks the hit list skipping avoided URLs when provided.
 * @param {string} query
 * @param {number} index
 * @param {{ signal?: AbortSignal, avoidUrls?: Iterable<string> }} [opts]
 */
export async function searchOxylabsGoogleImage(query, index = 0, opts = {}) {
  const hits = await searchOxylabsGoogleImages(query, { limit: 20, signal: opts.signal })
  if (!hits.length) return null
  const picked = pickOxylabsImageFromHits(hits, { index, avoidUrls: opts.avoidUrls })
  if (!picked) return null
  return {
    imgUrl: picked.imgUrl,
    title: picked.title || null,
    width: picked.width,
    height: picked.height,
    queryUsed: query,
    source: 'oxylabs',
    reused: picked.reused,
  }
}

/**
 * Status for Production UI — verifies Basic Auth against realtime API
 * with a tiny sandbox universal request (not a Google Images bill).
 * @returns {Promise<{ configured: boolean, ok: boolean, status?: number, detail?: string }>}
 */
export async function probeEofOxylabsApi() {
  const creds = getOxylabsCredentials()
  if (!creds) {
    return { configured: false, ok: false, detail: 'OXYLABS_USERNAME / OXYLABS_PASSWORD not set' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const res = await fetch(OXYLABS_REALTIME_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuthHeader(creds.username, creds.password),
        Accept: 'application/json',
      },
      body: JSON.stringify({
        source: 'universal',
        url: 'https://sandbox.oxylabs.io/',
      }),
      signal: controller.signal,
    })
    if (res.status === 401 || res.status === 403) {
      return {
        configured: true,
        ok: false,
        status: res.status,
        detail: 'Unauthorized — username/password rejected. Re-copy from Oxylabs dashboard into Vercel.',
      }
    }
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        status: res.status,
        detail: `API error HTTP ${res.status}`,
      }
    }
    return {
      configured: true,
      ok: true,
      status: res.status,
      detail: 'auth ok (Google Images ready)',
    }
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    return {
      configured: true,
      ok: false,
      detail: aborted ? 'probe timed out' : e instanceof Error ? e.message : 'probe failed',
    }
  } finally {
    clearTimeout(timer)
  }
}
