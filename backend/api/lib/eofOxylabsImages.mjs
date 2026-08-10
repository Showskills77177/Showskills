/**
 * Oxylabs Realtime API — Google Images search for EOF Shorts scene photos.
 *
 * Opt-in only (trial ended): requires OXYLABS_ENABLED=1 AND credentials.
 * Stale Vercel username/password alone must NOT trigger API calls or probes.
 *
 * Billing rule: at most ONE Google Images query per Short rebuild. All scenes
 * share that SERP pool (6–7 stills ≠ 6–7 credits).
 *
 * Docs: https://developers.oxylabs.io/api-targets/search-engines/google/search/image-search
 * Auth: Basic Auth (OXYLABS_USERNAME / OXYLABS_PASSWORD). Never log credentials.
 *
 * Env:
 *   OXYLABS_ENABLED=1       (required opt-in; omit/0 = skip entirely)
 *   OXYLABS_DISABLED=1      (optional hard off even if ENABLED)
 *   OXYLABS_USERNAME
 *   OXYLABS_PASSWORD
 *   OXYLABS_GEO_LOCATION   (optional, default "United States")
 */
import {
  resolveImageSubject,
  scoreImageRelevance,
  detectImageRoleIntent,
  scoreImageRoleIntentMatch,
  listSecondaryImageSubjects,
  topicLooksLikeCoach,
  hitMentionsSubject,
  isNamedFootballSubject,
  looksLikeGroupPhotoCue,
  looksLikeSoloPortraitCue,
  MIN_EOF_VISION_SCORE,
} from '../../../shared/eofSceneImageQueries.mjs'
import { isBlockedStockImageUrl, filterBlockedStockImages } from '../../../shared/eofStockImageFilter.mjs'

const OXYLABS_REALTIME_URL = 'https://realtime.oxylabs.io/v1/queries'
const DEFAULT_TIMEOUT_MS = 60_000
/** Keep only what a Short needs from one SERP page (billing is per query, not per URL). */
const DEFAULT_LIMIT = 12
/** Hard cap on billable Google Images queries per production job / rebuild.
 * 1 for single-subject Shorts; +1 allowed when a secondary person (e.g. Tuchel) needs a still. */
export const EOF_OXYLABS_MAX_QUERIES_PER_JOB = 2

function envTrim(name) {
  return String(process.env[name] || '').trim()
}

function envFlagOn(name) {
  const v = envTrim(name).toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function getOxylabsCredentials() {
  const username = envTrim('OXYLABS_USERNAME') || envTrim('OXYLABS_USER')
  const password = envTrim('OXYLABS_PASSWORD') || envTrim('OXYLABS_PASS')
  if (!username || !password) return null
  return { username, password }
}

/** Explicit opt-in. Without this, stale credentials on Vercel are ignored. */
export function isEofOxylabsEnabled() {
  if (envFlagOn('OXYLABS_DISABLED')) return false
  return envFlagOn('OXYLABS_ENABLED')
}

/**
 * Ready to use Oxylabs in the image pipeline.
 * Requires OXYLABS_ENABLED=1 (or true/on/yes) AND username+password.
 */
export function isEofOxylabsConfigured() {
  return isEofOxylabsEnabled() && Boolean(getOxylabsCredentials())
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

/** Prefer direct image hosts + portrait stills (Shorts are 9:16); demote tiny/junk thumbs. */
export function scoreImageCandidate(url, width = 0, height = 0) {
  const u = String(url || '').toLowerCase()
  let s = 0
  if (!isHttpUrl(url)) return -100
  if (isBlockedStockImageUrl(url)) return -200
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(url)) s += 25
  if (/encrypted-tbn\d*\.gstatic\.com/i.test(u)) s -= 15
  if (/gstatic\.com\/images/i.test(u) && /[?&]s=\d{1,2}(?:&|$)/i.test(u)) s -= 40
  if (/favicon|sprite|logo\.svg|1x1|pixel/i.test(u)) s -= 80
  const w = Number(width) || 0
  const h = Number(height) || 0
  const area = w * h
  if (area >= 1200 * 1200) s += 28
  else if (area >= 800 * 800) s += 20
  else if (area >= 400 * 400) s += 10
  else if (area > 0 && area < 120 * 120) s -= 30
  // Vertical / square frames survive 9:16 cover-crop better than wide landscapes.
  // Ultra-wide plates get letterboxed at encode time, but prefer not to pick them.
  if (w > 0 && h > 0) {
    if (h >= w * 1.15) s += 18
    else if (h >= w * 0.95) s += 8
    else if (w >= h * 2.2) s -= 28
    else if (w >= h * 1.6) s -= 18
  }
  // Tiny Serp gstatic thumbs upscale poorly into 9:16 — prefer originals.
  if (area > 0 && area < 280 * 280) s -= 25
  return s
}

/**
 * Job-level Google Images query for one Short. Prefer the person full name; bias
 * the era/role from script context (pundit desk vs playing career vs coach).
 * Still exactly ONE billable SERP query per Short — smarter wording, not more searches.
 *
 * @param {string} topic
 * @param {number} [attempt]
 * @param {{ plainTextDraft?: string, captions?: string|string[], intent?: string }} [context]
 */
/** Human-interest hair / look topics (Cucurella locks, etc.) — bias Google Images. */
const HAIR_TOPIC_RE = /\b(hair|hairstyle|locks?|dreadlocks?|beard|mullet|cut\s+his\s+hair|cut\s+her\s+hair|doesn'?t\s+cut)\b/i

export function buildOxylabsJobQuery(topic, attempt = 0, context = {}) {
  const subject =
    resolveImageSubject(topic || '', context.plainTextDraft || '') || String(topic || 'football').trim()
  const year = new Date().getFullYear()
  const blob = [topic, context.plainTextDraft, context.captions]
    .flat()
    .map((s) => String(s || ''))
    .join(' ')
  const intent = detectImageRoleIntent({
    topic,
    plainTextDraft: context.plainTextDraft,
    captions: context.captions,
    intent: context.intent,
  })
  const n = Math.max(0, Number(attempt) || 0) % 3

  // Hair / look stories: search the real player + hair cue (not the typo headline).
  if (HAIR_TOPIC_RE.test(blob) && /cucurella/i.test(subject)) {
    if (n === 1) return `"${subject}" Chelsea long hair`
    if (n === 2) return `"${subject}" hair portrait football`
    return `"${subject}" Chelsea hair`
  }
  if (HAIR_TOPIC_RE.test(blob) && isNamedFootballSubject(subject)) {
    if (n === 1) return `"${subject}" hair portrait`
    if (n === 2) return `"${subject}" football portrait`
    return `"${subject}" hair football`
  }

  if (intent === 'pundit') {
    if (n === 1) return `"${subject}" TV studio ${year}`
    if (n === 2) return `"${subject}" Sky Sports presenter`
    return `"${subject}" pundit`
  }
  if (intent === 'coach') {
    if (n === 1) return `"${subject}" manager press conference`
    if (n === 2) return `"${subject}" sideline ${year}`
    return `"${subject}" football manager`
  }
  if (intent === 'playing') {
    if (n === 1) return `"${subject}" football action`
    if (n === 2) return `"${subject}" celebrating football`
    return `"${subject}" football`
  }
  // Neutral rebuild rotations
  if (n === 1) return `"${subject}" football portrait`
  if (n === 2) return `"${subject}" football action`
  return `"${subject}" football`
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
  const filtered = filterBlockedStockImages(rows)
  filtered.sort(
    (a, b) => scoreImageCandidate(b.url, b.width, b.height) - scoreImageCandidate(a.url, a.width, a.height),
  )
  return filtered
}

/**
 * @typedef {'ok'|'empty'|'auth_failed'|'not_configured'|'http_error'|'timeout'|'error'} EofOxylabsSearchStatus
 * @typedef {{
 *   status: EofOxylabsSearchStatus,
 *   detail: string,
 *   httpStatus?: number,
 *   softFallback: boolean,
 * }} EofOxylabsSearchHealth
 */

/**
 * Ops-facing note: missing keys vs auth down vs empty SERP (all soft-fall back).
 * @param {EofOxylabsSearchHealth | null | undefined} health
 */
export function formatOxylabsSearchHealthNote(health) {
  if (!health) return null
  if (health.status === 'not_configured') {
    if (health.disabled || String(health.detail || '').includes('OXYLABS_ENABLED')) {
      return 'Oxylabs: off (opt-in only — set OXYLABS_ENABLED=1 + credentials when trial renewed).'
    }
    return 'Oxylabs: credentials missing (OXYLABS_USERNAME / OXYLABS_PASSWORD) — soft-falling back to next image source.'
  }
  if (health.status === 'auth_failed') {
    return `Oxylabs: search DOWN (auth ${health.httpStatus || 401}) — soft-falling back. Re-copy username/password from Oxylabs dashboard into Vercel and redeploy.`
  }
  if (health.status === 'http_error') {
    return `Oxylabs: search DOWN (HTTP ${health.httpStatus || '?'}) — soft-falling back. ${health.detail || ''}`.trim()
  }
  if (health.status === 'timeout') {
    return 'Oxylabs: search timed out — soft-falling back to next image source.'
  }
  if (health.status === 'error') {
    return `Oxylabs: search error — soft-falling back. ${health.detail || ''}`.trim()
  }
  if (health.status === 'empty') {
    return 'Oxylabs: auth OK but SERP returned 0 image URLs — soft-falling back (not an auth outage).'
  }
  return null
}

/**
 * Search Google Images via Oxylabs realtime API (structured health for ops).
 * Soft-fails to empty hits; never throws on auth/HTTP errors.
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<{
 *   hits: Array<{ url: string, width?: number, height?: number, title?: string|null, source: 'oxylabs' }>,
 *   health: EofOxylabsSearchHealth,
 * }>}
 */
export async function searchOxylabsGoogleImagesWithStatus(query, opts = {}) {
  if (!isEofOxylabsEnabled()) {
    return {
      hits: [],
      health: {
        status: 'not_configured',
        disabled: true,
        detail: 'Oxylabs disabled (set OXYLABS_ENABLED=1 to opt in when trial renewed)',
        softFallback: true,
      },
    }
  }
  const creds = getOxylabsCredentials()
  if (!creds) {
    return {
      hits: [],
      health: {
        status: 'not_configured',
        detail: 'OXYLABS_USERNAME / OXYLABS_PASSWORD not set',
        softFallback: true,
      },
    }
  }

  const q = String(query || '').trim()
  if (!q) {
    return {
      hits: [],
      health: { status: 'empty', detail: 'empty query', softFallback: true },
    }
  }

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
      // Docs prefer udm=2 for Image Search. pages:1 = one SERP page = one credit.
      body: JSON.stringify({
        source: 'google_search',
        query: q,
        geo_location: oxylabsGeoLocation(),
        parse: true,
        pages: 1,
        context: [{ key: 'udm', value: 2 }],
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      // Never include auth material; body slice only.
      if (res.status === 401 || res.status === 403) {
        console.warn(
          '[eof-oxylabs] SEARCH DOWN (auth failed)',
          res.status,
          '— soft-fallback to next source. OXYLABS_PASSWORD on Vercel does not match the Oxylabs dashboard user.',
        )
        return {
          hits: [],
          health: {
            status: 'auth_failed',
            detail: 'Unauthorized — username/password rejected',
            httpStatus: res.status,
            softFallback: true,
          },
        }
      }
      console.warn('[eof-oxylabs] SEARCH DOWN (http)', res.status, body.slice(0, 180), '— soft-fallback')
      // Same split as SerpAPI: only 429 / an explicit message means the plan is spent.
      const outOfRequests =
        res.status === 429 || /quota|out of requests|limit reached/i.test(body)
      return {
        hits: [],
        health: {
          status: outOfRequests ? 'quota_exceeded' : 'http_error',
          detail: outOfRequests
            ? `Oxylabs plan requests exhausted (HTTP ${res.status})`
            : `API error HTTP ${res.status}`,
          httpStatus: res.status,
          softFallback: true,
        },
      }
    }

    const data = await res.json()
    const rows = extractOxylabsImageRows(data)
    console.info('[eof-oxylabs] google images', q.slice(0, 60), '→', rows.length, 'urls')
    if (!rows.length) {
      console.warn(
        '[eof-oxylabs] parsed 0 image URLs (auth OK — empty SERP, not an outage) for',
        q.slice(0, 60),
      )
      return {
        hits: [],
        health: {
          status: 'empty',
          detail: 'auth ok but 0 image URLs parsed',
          httpStatus: res.status,
          softFallback: true,
        },
      }
    }

    return {
      hits: rows.slice(0, limit).map((r) => ({
        url: r.url,
        width: r.width,
        height: r.height,
        title: r.title || null,
        source: 'oxylabs',
      })),
      health: {
        status: 'ok',
        detail: `${rows.length} urls`,
        httpStatus: res.status,
        softFallback: false,
      },
    }
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    if (aborted) {
      console.warn('[eof-oxylabs] SEARCH DOWN (timeout/abort) — soft-fallback')
    } else {
      console.warn('[eof-oxylabs] SEARCH DOWN (error)', e instanceof Error ? e.message : e, '— soft-fallback')
    }
    return {
      hits: [],
      health: {
        status: aborted ? 'timeout' : 'error',
        detail: aborted ? 'search timed out or aborted' : e instanceof Error ? e.message : 'search failed',
        softFallback: true,
      },
    }
  } finally {
    clearTimeout(timer)
    if (external) external.removeEventListener('abort', onAbort)
  }
}

/**
 * Search Google Images via Oxylabs realtime API.
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<Array<{ url: string, width?: number, height?: number, title?: string|null, source: 'oxylabs' }>>}
 */
export async function searchOxylabsGoogleImages(query, opts = {}) {
  const { hits } = await searchOxylabsGoogleImagesWithStatus(query, opts)
  return hits
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
  const hits = await searchOxylabsGoogleImages(query, {
    limit: Math.min(12, Number(opts.limit) || DEFAULT_LIMIT),
    signal: opts.signal,
  })
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
 * ONE billable Google Images query for an entire Short (all scenes share the SERP pool).
 * For 6–7 scenes this costs 1 credit, not 6–7.
 * @param {{ topic?: string, sceneCount?: number, attempt?: number, signal?: AbortSignal, plainTextDraft?: string, captions?: string|string[], intent?: string }} opts
 */
export async function fetchEofOxylabsJobPool(opts = {}) {
  const sceneCount = Math.max(1, Math.min(12, Number(opts.sceneCount) || 6))
  const attempt = Math.max(0, Number(opts.attempt) || 0)
  const context = {
    plainTextDraft: opts.plainTextDraft,
    captions: opts.captions,
    intent: opts.intent,
  }
  const intent = detectImageRoleIntent({ topic: opts.topic, ...context })
  const query = buildOxylabsJobQuery(opts.topic || '', attempt, context)

  // Tight pool sized to scene count — do not keep 20 Rooney stills for a 3–4 beat Short.
  const need = Math.max(3, sceneCount + 1)
  const fetchLimit = Math.min(24, Math.max(10, need * 2))
  const { hits: rawHits, health } = await searchOxylabsGoogleImagesWithStatus(query, {
    limit: fetchLimit,
    signal: opts.signal,
  })
  const hits = filterBlockedStockImages(rawHits)
  const kept = hits.slice(0, Math.min(hits.length, need + 2))
  const healthNote = formatOxylabsSearchHealthNote(health)
  if (healthNote) console.warn('[eof-oxylabs] job pool', healthNote)
  console.info(
    '[eof-oxylabs] job pool',
    query.slice(0, 60),
    `intent=${intent}`,
    `scenes=${sceneCount}`,
    `kept=${kept.length}/${fetchLimit}`,
    `health=${health.status}`,
    `(≤${EOF_OXYLABS_MAX_QUERIES_PER_JOB} queries/Short — not per scene)`,
  )
  return {
    query,
    intent,
    subject: resolveImageSubject(opts.topic || '', opts.plainTextDraft || '') || null,
    health,
    healthNote,
    hits: kept.map((h) => ({
      url: h.url,
      title: h.title || null,
      width: h.width,
      height: h.height,
    })),
  }
}

/**
 * Optional second credit: stills for a secondary person (Tuchel when lead is Rooney).
 * @param {{ topic?: string, plainTextDraft?: string, captions?: string|string[], signal?: AbortSignal }} opts
 */
export async function fetchEofOxylabsSecondaryPool(opts = {}) {
  const secondary = listSecondaryImageSubjects(opts.topic || '', opts.plainTextDraft || '')
  const person = secondary[0]
  if (!person) return null
  const intent = topicLooksLikeCoach(person) ? 'coach' : 'neutral'
  const query =
    intent === 'coach'
      ? `"${person}" manager sideline`
      : `"${person}" football portrait`
  const { hits: rawHits, health } = await searchOxylabsGoogleImagesWithStatus(query, {
    limit: 8,
    signal: opts.signal,
  })
  const hits = filterBlockedStockImages(rawHits).slice(0, 5)
  const healthNote = formatOxylabsSearchHealthNote(health)
  if (healthNote) console.warn('[eof-oxylabs] secondary pool', healthNote)
  console.info(
    '[eof-oxylabs] secondary pool',
    person,
    `kept=${hits.length}`,
    `health=${health.status}`,
    '(+1 credit)',
  )
  if (!hits.length) return null
  return {
    subject: person,
    query,
    intent,
    health,
    healthNote,
    hits: hits.map((h) => ({
      url: h.url,
      title: h.title || null,
      width: h.width,
      height: h.height,
    })),
  }
}

/**
 * Rank a SERP hit for a specific scene using title relevance + portrait preference.
 * Do NOT inject the job search query into the haystack — that hid weak titles.
 * @param {{ url?: string, title?: string|null, width?: number, height?: number }} hit
 * @param {{ topic?: string, subject?: string, imageQuery?: string, caption?: string, plainTextDraft?: string, intent?: string, jobQuery?: string, query?: string, poolQuery?: string }} scene
 */
export function scoreOxylabsHitForScene(hit, scene = {}) {
  const title = String(hit?.title || '').trim()
  const topic = String(scene.topic || '').trim()
  const imageQuery = String(scene.imageQuery || '').trim()
  const caption = String(scene.caption || '').trim()
  // Always resolve mononyms / "Rooney on Ronaldo" → Wayne Rooney (never surname=Ronaldo).
  const subject =
    resolveImageSubject(scene.subject || topic, scene.plainTextDraft || '') ||
    String(scene.subject || topic || '').trim()
  const intent = detectImageRoleIntent({
    topic,
    imageQuery,
    caption,
    plainTextDraft: scene.plainTextDraft,
    intent: scene.intent,
  })
  const url = String(hit?.url || hit?.localPath || '')
  const src = String(hit?.source || '')
  const isGen = src === 'grok-imagine' || src === 'free-gen'
  const vision = Number(hit?.visionScore)
  const poolQuery = String(scene.jobQuery || scene.poolQuery || scene.query || '').trim()
  // Google Images often returns CDN URLs with empty titles; if the Serp query already
  // named the person (`"Marc Cucurella" Chelsea hair`), keep those hits claimable.
  const queryNamesSubject = Boolean(poolQuery) && hitMentionsSubject(subject, poolQuery, '')
  const emptyTitleQueryOk = queryNamesSubject && !title && Boolean(url)

  // Named subject (Rooney / Tuchel / …): title/URL must name them, OR vision already verified.
  if (isNamedFootballSubject(subject) && !isGen) {
    const visionOk = Number.isFinite(vision) && vision >= MIN_EOF_VISION_SCORE
    if (!visionOk && !hitMentionsSubject(subject, title, url) && !emptyTitleQueryOk) {
      return -500
    }
    // Vision already rejected this face — never claim.
    // Exception: empty-title CDN thumbs kept by name-cue fallback often carry a low
    // visionScore (Grok fails on tiny Serp thumbs). emptyTitleQueryOk must still claim.
    if (Number.isFinite(vision) && vision < MIN_EOF_VISION_SCORE && !emptyTitleQueryOk) {
      return -500
    }
  }

  const relevance = scoreImageRelevance(topic || imageQuery || caption, title, imageQuery || caption, {
    intent,
    plainTextDraft: scene.plainTextDraft,
    captions: caption,
  })
  if (isBlockedStockImageUrl(hit?.url, title)) return -500
  const portrait = scoreImageCandidate(hit?.url, hit?.width, hit?.height)
  // Caption tokens in the title (tactics / England / celebrate) get a small extra nudge.
  let captionBoost = 0
  const hay = `${title} ${url}`.toLowerCase()
  for (const tok of caption.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 5)) {
    if (hay.includes(tok)) captionBoost += 3
  }
  // URL-only era cues (titles already scored inside scoreImageRelevance).
  const urlRole = scoreImageRoleIntentMatch(intent, String(hit?.url || ''))
  const visionBoost = Number.isFinite(vision) ? (vision - 5) * 8 : 0

  // Prefer solo/clear face stills; demote duo/group posing titles unless vision scored high.
  let groupPenalty = 0
  if (looksLikeGroupPhotoCue(title, url) && !(Number.isFinite(vision) && vision >= 8)) {
    groupPenalty = -60
  } else if (looksLikeSoloPortraitCue(title, url)) {
    groupPenalty = 12
  }

  return (
    relevance * 12 +
    Math.max(-20, Math.min(40, portrait)) +
    captionBoost +
    urlRole +
    visionBoost +
    groupPenalty
  )
}

/**
 * Claim a unique URL from a shared job pool (safe under scene concurrency).
 * Prefers the best title match for this scene’s topic/imageQuery/caption, not blind rotation.
 * @param {{ hits: Array<{ url: string, title?: string|null, width?: number, height?: number }>, claimed: Set<string>, avoidKeys?: Iterable<string>, index?: number, topic?: string, imageQuery?: string, caption?: string, plainTextDraft?: string, intent?: string, keyPrefix?: string }} opts
 */
export function claimOxylabsPoolHit(opts = {}) {
  const hits = Array.isArray(opts.hits) ? opts.hits : []
  const claimed = opts.claimed instanceof Set ? opts.claimed : new Set()
  const prefix = String(opts.keyPrefix || 'oxylabs').trim() || 'oxylabs'
  const prefixTag = `${prefix}:`
  const avoid = new Set()
  for (const raw of opts.avoidKeys || []) {
    const k = String(raw || '').trim()
    if (!k) continue
    avoid.add(k)
    if (k.startsWith(prefixTag)) avoid.add(k.slice(prefixTag.length))
    else avoid.add(`${prefixTag}${k}`)
  }

  const poolQuery = String(opts.jobQuery || opts.query || opts.poolQuery || '').trim()
  const scene = {
    topic: opts.topic,
    subject: opts.subject || resolveImageSubject(opts.topic, opts.plainTextDraft || '') || opts.topic,
    imageQuery: opts.imageQuery,
    caption: opts.caption,
    plainTextDraft: opts.plainTextDraft,
    intent: opts.intent,
    jobQuery: poolQuery,
  }
  const subject =
    resolveImageSubject(scene.subject || scene.topic, scene.plainTextDraft || '') ||
    String(scene.subject || '').trim()
  const queryNamesSubject = Boolean(poolQuery) && hitMentionsSubject(subject, poolQuery, '')
  const ranked = hits
    .map((hit, i) => {
      const hitSource = String(hit?.source || '').trim()
      const usePrefix =
        hitSource === 'grok-imagine' || hitSource === 'free-gen' ? hitSource : prefix
      const identity = String(hit?.localPath || hit?.url || '').trim()
      const score = scoreOxylabsHitForScene(hit, scene)
      const emptyTitleQueryOk =
        queryNamesSubject && !String(hit?.title || '').trim() && Boolean(identity)
      if (
        score <= -400 &&
        isNamedFootballSubject(subject) &&
        !hitMentionsSubject(subject, hit?.title || '', identity) &&
        !emptyTitleQueryOk
      ) {
        console.info(
          '[eof-images] reject claim candidate',
          subject.slice(0, 40),
          `score=${score}`,
          String(hit?.title || hit?.url || '').slice(0, 90),
        )
      }
      return {
        hit,
        url: String(hit?.url || hit?.localPath || '').trim(),
        localPath: hit?.localPath ? String(hit.localPath).trim() : null,
        hitSource: hitSource || null,
        key: `${usePrefix}:${identity}`,
        score,
        // Tiny index bias so rebuilds still diversify when scores tie.
        // Prefer scrape over AI gen when title scores are equal.
        genPenalty: hitSource === 'grok-imagine' || hitSource === 'free-gen' ? 1 : 0,
        tie: (i + Math.max(0, Number(opts.index) || 0)) % Math.max(1, hits.length),
      }
    })
    .filter((row) => row.url)
    .sort((a, b) => b.score - a.score || a.genPenalty - b.genPenalty || a.tie - b.tie)

  // Never claim Getty/meme/quote-card / wrong-subject hits (score ≤ -100).
  const usable = ranked.filter((row) => row.score > -100)
  const subjectCueOk = (title, url, hitSource) => {
    if (hitSource === 'grok-imagine' || hitSource === 'free-gen') return true
    if (!isNamedFootballSubject(subject)) return true
    if (hitMentionsSubject(subject, title || '', url || '')) return true
    // Empty-title Serp CDN row kept because the job query named the person.
    return queryNamesSubject && !String(title || '').trim() && Boolean(url)
  }
  let fallback = null
  for (const row of usable) {
    if (claimed.has(row.key)) continue
    if (avoid.has(row.url) || avoid.has(row.key) || (row.localPath && avoid.has(row.localPath))) {
      // Avoid-history reuse is OK only when the still still names the subject.
      if (!subjectCueOk(row.hit?.title || '', row.url, row.hitSource)) {
        continue
      }
      if (!fallback) fallback = { ...row, reused: true }
      continue
    }
    claimed.add(row.key)
    return {
      imgUrl: row.url,
      localPath: row.localPath,
      hitSource: row.hitSource,
      title: row.hit.title || null,
      width: row.hit.width,
      height: row.hit.height,
      key: row.key,
      reused: false,
      sceneScore: row.score,
    }
  }
  if (!fallback) return null
  // Named-subject Shorts: never fall back to a still that does not name the person.
  if (!subjectCueOk(fallback.hit?.title || '', fallback.url, fallback.hitSource)) {
    console.info(
      '[eof-images] refuse fallback without subject cue',
      subject.slice(0, 40),
      String(fallback.hit?.title || fallback.url).slice(0, 90),
    )
    return null
  }
  claimed.add(fallback.key)
  return {
    imgUrl: fallback.url,
    localPath: fallback.localPath,
    hitSource: fallback.hitSource,
    title: fallback.hit.title || null,
    width: fallback.hit.width,
    height: fallback.hit.height,
    key: fallback.key,
    reused: true,
    sceneScore: fallback.score,
  }
}

/**
 * Status for Production UI — verifies Basic Auth against realtime API
 * with a tiny sandbox universal request (not a Google Images bill).
 * @returns {Promise<{ configured: boolean, ok: boolean, status?: number, detail?: string }>}
 */
export async function probeEofOxylabsApi() {
  if (!isEofOxylabsEnabled()) {
    return {
      configured: false,
      ok: false,
      disabled: true,
      detail:
        'Oxylabs off (opt-in). Trial ended — set OXYLABS_ENABLED=1 + credentials only when renewed. Safe to remove OXYLABS_* from Vercel.',
    }
  }
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
        degraded: true,
        softFallback: true,
        detail:
          'SEARCH DOWN — Unauthorized (username/password rejected). Soft-fallback to SerpAPI/AP/Wikimedia until keys are fixed on Vercel.',
      }
    }
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        status: res.status,
        degraded: true,
        softFallback: true,
        detail: `SEARCH DOWN — API error HTTP ${res.status}. Soft-fallback active.`,
      }
    }
    return {
      configured: true,
      ok: true,
      status: res.status,
      degraded: false,
      softFallback: false,
      detail: 'auth ok (Google Images ready)',
    }
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    return {
      configured: true,
      ok: false,
      degraded: true,
      softFallback: true,
      detail: aborted
        ? 'SEARCH DOWN — probe timed out. Soft-fallback active.'
        : `SEARCH DOWN — ${e instanceof Error ? e.message : 'probe failed'}. Soft-fallback active.`,
    }
  } finally {
    clearTimeout(timer)
  }
}
