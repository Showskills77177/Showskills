/**
 * Oxylabs Realtime API — Google Images search for EOF Shorts scene photos.
 *
 * Billing rule: at most ONE Google Images query per Short rebuild. All scenes
 * share that SERP pool (6–7 stills ≠ 6–7 credits).
 *
 * Docs: https://developers.oxylabs.io/api-targets/search-engines/google/search/image-search
 * Auth: Basic Auth (OXYLABS_USERNAME / OXYLABS_PASSWORD). Never log credentials.
 *
 * Env:
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
  if (w > 0 && h > 0) {
    if (h >= w * 1.15) s += 18
    else if (h >= w * 0.95) s += 8
    else if (w >= h * 1.6) s -= 12
  }
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
export function buildOxylabsJobQuery(topic, attempt = 0, context = {}) {
  const subject = resolveImageSubject(topic || '') || String(topic || 'football').trim()
  const year = new Date().getFullYear()
  const intent = detectImageRoleIntent({
    topic,
    plainTextDraft: context.plainTextDraft,
    captions: context.captions,
    intent: context.intent,
  })
  const n = Math.max(0, Number(attempt) || 0) % 3

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
  const hits = filterBlockedStockImages(
    await searchOxylabsGoogleImages(query, {
      limit: fetchLimit,
      signal: opts.signal,
    }),
  )
  const kept = hits.slice(0, Math.min(hits.length, need + 2))
  console.info(
    '[eof-oxylabs] job pool',
    query.slice(0, 60),
    `intent=${intent}`,
    `scenes=${sceneCount}`,
    `kept=${kept.length}/${fetchLimit}`,
    `(≤${EOF_OXYLABS_MAX_QUERIES_PER_JOB} queries/Short — not per scene)`,
  )
  return {
    query,
    intent,
    subject: resolveImageSubject(opts.topic || '') || null,
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
  const hits = filterBlockedStockImages(
    await searchOxylabsGoogleImages(query, { limit: 8, signal: opts.signal }),
  ).slice(0, 5)
  console.info('[eof-oxylabs] secondary pool', person, `kept=${hits.length}`, '(+1 credit)')
  if (!hits.length) return null
  return {
    subject: person,
    query,
    intent,
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
 * @param {{ topic?: string, imageQuery?: string, caption?: string, plainTextDraft?: string, intent?: string }} scene
 */
export function scoreOxylabsHitForScene(hit, scene = {}) {
  const title = String(hit?.title || '').trim()
  const topic = String(scene.topic || '').trim()
  const imageQuery = String(scene.imageQuery || '').trim()
  const caption = String(scene.caption || '').trim()
  const intent = detectImageRoleIntent({
    topic,
    imageQuery,
    caption,
    plainTextDraft: scene.plainTextDraft,
    intent: scene.intent,
  })
  const relevance = scoreImageRelevance(topic || imageQuery || caption, title, imageQuery || caption, {
    intent,
    plainTextDraft: scene.plainTextDraft,
    captions: caption,
  })
  if (isBlockedStockImageUrl(hit?.url, title)) return -500
  const portrait = scoreImageCandidate(hit?.url, hit?.width, hit?.height)
  // Caption tokens in the title (tactics / England / celebrate) get a small extra nudge.
  let captionBoost = 0
  const hay = `${title} ${hit?.url || ''}`.toLowerCase()
  for (const tok of caption.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 5)) {
    if (hay.includes(tok)) captionBoost += 3
  }
  // URL-only era cues (titles already scored inside scoreImageRelevance).
  const urlRole = scoreImageRoleIntentMatch(intent, String(hit?.url || ''))
  const vision = Number(hit?.visionScore)
  const visionBoost = Number.isFinite(vision) ? (vision - 5) * 8 : 0
  return relevance * 12 + Math.max(-20, Math.min(40, portrait)) + captionBoost + urlRole + visionBoost
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

  const scene = {
    topic: opts.topic,
    imageQuery: opts.imageQuery,
    caption: opts.caption,
    plainTextDraft: opts.plainTextDraft,
    intent: opts.intent,
  }
  const ranked = hits
    .map((hit, i) => ({
      hit,
      url: String(hit?.url || '').trim(),
      key: `${prefixTag}${String(hit?.url || '').trim()}`,
      score: scoreOxylabsHitForScene(hit, scene),
      // Tiny index bias so rebuilds still diversify when scores tie.
      tie: (i + Math.max(0, Number(opts.index) || 0)) % Math.max(1, hits.length),
    }))
    .filter((row) => row.url)
    .sort((a, b) => b.score - a.score || a.tie - b.tie)

  let fallback = null
  for (const row of ranked) {
    if (claimed.has(row.key)) continue
    if (avoid.has(row.url) || avoid.has(row.key)) {
      if (!fallback) fallback = { ...row, reused: true }
      continue
    }
    claimed.add(row.key)
    return {
      imgUrl: row.url,
      title: row.hit.title || null,
      width: row.hit.width,
      height: row.hit.height,
      key: row.key,
      reused: false,
      sceneScore: row.score,
    }
  }
  if (!fallback) return null
  claimed.add(fallback.key)
  return {
    imgUrl: fallback.url,
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
