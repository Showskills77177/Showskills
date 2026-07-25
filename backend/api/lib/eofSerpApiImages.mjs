/**
 * SerpAPI Google Images for EOF Shorts scene photos (primary Google Images source).
 *
 * Billing: 1 Google Images query for the lead subject pool (+ optional 1 for a
 * secondary person). Scenes share pools — not one credit per scene.
 *
 * Docs: https://serpapi.com/google-images-api
 * Key: https://serpapi.com/manage-api-key
 *
 * Env:
 *   SERPAPI_API_KEY   (primary; alias SERP_API_KEY)
 *   SERPAPI_ENGINE    (optional, default google_images)
 *   SERPAPI_GL        (optional country, e.g. uk)
 *   SERPAPI_HL        (optional language, e.g. en)
 */
import {
  buildOxylabsJobQuery,
  scoreImageCandidate,
  claimOxylabsPoolHit,
} from './eofOxylabsImages.mjs'
import {
  detectImageRoleIntent,
  resolveImageSubject,
  listSecondaryImageSubjects,
  topicLooksLikeCoach,
} from '../../../shared/eofSceneImageQueries.mjs'
import { filterBlockedStockImages, isBlockedStockImageUrl } from '../../../shared/eofStockImageFilter.mjs'

const SERPAPI_SEARCH_URL = 'https://serpapi.com/search.json'
const SERPAPI_ACCOUNT_URL = 'https://serpapi.com/account.json'
const DEFAULT_TIMEOUT_MS = 45_000
const DEFAULT_LIMIT = 12
/** Hard cap on billable Google Images queries per production job / rebuild. */
export const EOF_SERPAPI_MAX_QUERIES_PER_JOB = 2

function envTrim(name) {
  return String(process.env[name] || '').trim()
}

export function getSerpApiKey() {
  return envTrim('SERPAPI_API_KEY') || envTrim('SERP_API_KEY') || ''
}

export function isEofSerpApiConfigured() {
  return Boolean(getSerpApiKey())
}

export function serpApiEngine() {
  return envTrim('SERPAPI_ENGINE') || 'google_images'
}

export function serpApiGl() {
  return envTrim('SERPAPI_GL') || ''
}

export function serpApiHl() {
  return envTrim('SERPAPI_HL') || ''
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/**
 * Build SerpAPI Google Images search URL (does not include the API key in logs — caller strips).
 * @param {string} query
 * @param {{ apiKey?: string, engine?: string, gl?: string, hl?: string, ijn?: number }} [opts]
 */
export function buildSerpApiImagesSearchUrl(query, opts = {}) {
  const q = String(query || '').trim()
  const url = new URL(SERPAPI_SEARCH_URL)
  url.searchParams.set('engine', opts.engine || serpApiEngine())
  url.searchParams.set('q', q)
  const gl = opts.gl != null ? String(opts.gl).trim() : serpApiGl()
  const hl = opts.hl != null ? String(opts.hl).trim() : serpApiHl()
  if (gl) url.searchParams.set('gl', gl)
  if (hl) url.searchParams.set('hl', hl)
  if (opts.ijn != null && Number.isFinite(Number(opts.ijn))) {
    url.searchParams.set('ijn', String(Math.max(0, Number(opts.ijn) || 0)))
  }
  const apiKey = opts.apiKey != null ? String(opts.apiKey) : getSerpApiKey()
  if (apiKey) url.searchParams.set('api_key', apiKey)
  return url
}

/**
 * Walk SerpAPI google_images JSON and collect image rows (prefer original over thumbnail).
 * @param {unknown} payload
 * @returns {Array<{ url: string, width?: number, height?: number, title?: string|null }>}
 */
export function extractSerpApiImageRows(payload) {
  const rows = []
  const seen = new Set()
  const images = payload && typeof payload === 'object' ? payload.images_results : null
  if (!Array.isArray(images)) return rows

  for (const item of images) {
    if (!item || typeof item !== 'object') continue
    const original = item.original || item.original_image || item.link
    const thumb = item.thumbnail
    const candidates = [original, thumb].filter(isHttpUrl).map((u) => String(u).trim())
    if (!candidates.length) continue

    let best = null
    let bestScore = -Infinity
    const w = Number(item.original_width || item.width || 0) || 0
    const h = Number(item.original_height || item.height || 0) || 0
    for (const url of candidates) {
      const score = scoreImageCandidate(url, w, h)
      if (score > bestScore) {
        bestScore = score
        best = { url, width: w || undefined, height: h || undefined, title: item.title || null }
      }
    }
    if (!best || bestScore < -50 || seen.has(best.url)) continue
    if (isBlockedStockImageUrl(best.url, best.title)) continue
    seen.add(best.url)
    rows.push(best)
  }

  const filtered = filterBlockedStockImages(rows)
  filtered.sort(
    (a, b) => scoreImageCandidate(b.url, b.width, b.height) - scoreImageCandidate(a.url, a.width, a.height),
  )
  return filtered
}

/**
 * @typedef {'ok'|'empty'|'auth_failed'|'not_configured'|'http_error'|'timeout'|'error'|'api_error'} EofSerpApiSearchStatus
 * @typedef {{
 *   status: EofSerpApiSearchStatus,
 *   detail: string,
 *   httpStatus?: number,
 *   softFallback: boolean,
 * }} EofSerpApiSearchHealth
 */

/**
 * Ops-facing note for SerpAPI soft-fallback (mirrors Oxylabs).
 * @param {EofSerpApiSearchHealth | null | undefined} health
 */
export function formatSerpApiSearchHealthNote(health) {
  if (!health) return null
  if (health.status === 'not_configured') {
    return 'SerpAPI: SERPAPI_API_KEY not set — soft-falling back to next image source.'
  }
  if (health.status === 'auth_failed') {
    return `SerpAPI: auth failed (${health.httpStatus || 401}) — soft-falling back. Re-copy SERPAPI_API_KEY from https://serpapi.com/manage-api-key and redeploy.`
  }
  if (health.status === 'http_error') {
    return `SerpAPI: HTTP ${health.httpStatus || '?'} — soft-falling back. ${health.detail || ''}`.trim()
  }
  if (health.status === 'api_error') {
    return `SerpAPI: API error — soft-falling back. ${health.detail || ''}`.trim()
  }
  if (health.status === 'timeout') {
    return 'SerpAPI: search timed out — soft-falling back to next image source.'
  }
  if (health.status === 'error') {
    return `SerpAPI: search error — soft-falling back. ${health.detail || ''}`.trim()
  }
  if (health.status === 'empty') {
    return 'SerpAPI: auth OK but Google Images returned 0 usable URLs — soft-falling back.'
  }
  return null
}

/**
 * Search Google Images via SerpAPI (structured health for ops / user errors).
 * Soft-fails to empty hits; never throws on auth/HTTP errors.
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<{
 *   hits: Array<{ url: string, width?: number, height?: number, title?: string|null, source: 'serpapi' }>,
 *   health: EofSerpApiSearchHealth,
 * }>}
 */
export async function searchSerpApiGoogleImagesWithStatus(query, opts = {}) {
  const apiKey = getSerpApiKey()
  if (!apiKey) {
    return {
      hits: [],
      health: {
        status: 'not_configured',
        detail: 'SERPAPI_API_KEY not set',
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
    const url = buildSerpApiImagesSearchUrl(q, { apiKey })
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      if (res.status === 401 || res.status === 403) {
        console.warn(
          '[eof-serpapi] auth failed',
          res.status,
          '— SERPAPI_API_KEY rejected (check https://serpapi.com/manage-api-key).',
        )
        return {
          hits: [],
          health: {
            status: 'auth_failed',
            detail: 'Unauthorized — API key rejected',
            httpStatus: res.status,
            softFallback: true,
          },
        }
      }
      console.warn('[eof-serpapi] search failed', res.status, body.slice(0, 180))
      return {
        hits: [],
        health: {
          status: 'http_error',
          detail: `API error HTTP ${res.status}`,
          httpStatus: res.status,
          softFallback: true,
        },
      }
    }

    const data = await res.json()
    if (data?.error) {
      const errText = String(data.error).slice(0, 180)
      console.warn('[eof-serpapi] API error', errText)
      const authish = /invalid api key|unauthorized|forbidden|api_key/i.test(errText)
      return {
        hits: [],
        health: {
          status: authish ? 'auth_failed' : 'api_error',
          detail: errText,
          softFallback: true,
        },
      }
    }

    const rows = extractSerpApiImageRows(data)
    console.info('[eof-serpapi] google images', q.slice(0, 60), '→', rows.length, 'urls')
    if (!rows.length) {
      console.warn('[eof-serpapi] parsed 0 image URLs for', q.slice(0, 60))
      return {
        hits: [],
        health: {
          status: 'empty',
          detail: 'auth ok but 0 image URLs parsed',
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
        source: 'serpapi',
      })),
      health: {
        status: 'ok',
        detail: `${rows.length} urls`,
        softFallback: false,
      },
    }
  } catch (e) {
    const aborted = e?.name === 'AbortError'
    if (aborted) {
      console.warn('[eof-serpapi] search timed out or aborted')
    } else {
      console.warn('[eof-serpapi] search error', e instanceof Error ? e.message : e)
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
 * Search Google Images via SerpAPI.
 * @param {string} query
 * @param {{ limit?: number, signal?: AbortSignal, timeoutMs?: number }} [opts]
 * @returns {Promise<Array<{ url: string, width?: number, height?: number, title?: string|null, source: 'serpapi' }>>}
 */
export async function searchSerpApiGoogleImages(query, opts = {}) {
  const { hits } = await searchSerpApiGoogleImagesWithStatus(query, opts)
  return hits
}

/**
 * ONE billable Google Images query for an entire Short (all scenes share the SERP pool).
 * @param {{ topic?: string, sceneCount?: number, attempt?: number, signal?: AbortSignal, plainTextDraft?: string, captions?: string|string[], intent?: string }} opts
 */
export async function fetchEofSerpApiJobPool(opts = {}) {
  const sceneCount = Math.max(1, Math.min(12, Number(opts.sceneCount) || 6))
  const attempt = Math.max(0, Number(opts.attempt) || 0)
  const context = {
    plainTextDraft: opts.plainTextDraft,
    captions: opts.captions,
    intent: opts.intent,
  }
  const intent = detectImageRoleIntent({ topic: opts.topic, ...context })
  const query = buildOxylabsJobQuery(opts.topic || '', attempt, context)

  const need = Math.max(3, sceneCount + 1)
  const fetchLimit = Math.min(24, Math.max(10, need * 2))
  const { hits: rawHits, health } = await searchSerpApiGoogleImagesWithStatus(query, {
    limit: fetchLimit,
    signal: opts.signal,
  })
  const hits = filterBlockedStockImages(rawHits)
  const kept = hits.slice(0, Math.min(hits.length, need + 2))
  const healthNote = formatSerpApiSearchHealthNote(health)
  if (healthNote) console.warn('[eof-serpapi] job pool', healthNote)
  console.info(
    '[eof-serpapi] job pool',
    query.slice(0, 60),
    `intent=${intent}`,
    `scenes=${sceneCount}`,
    `kept=${kept.length}/${fetchLimit}`,
    `health=${health.status}`,
    `(≤${EOF_SERPAPI_MAX_QUERIES_PER_JOB} queries/Short — not per scene)`,
  )
  return {
    query,
    intent,
    source: 'serpapi',
    subject: resolveImageSubject(opts.topic || '') || null,
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
 * Optional second SerpAPI credit for a secondary person (e.g. Tuchel).
 * @param {{ topic?: string, plainTextDraft?: string, signal?: AbortSignal }} opts
 */
export async function fetchEofSerpApiSecondaryPool(opts = {}) {
  const secondary = listSecondaryImageSubjects(opts.topic || '', opts.plainTextDraft || '')
  const person = secondary[0]
  if (!person) return null
  const intent = topicLooksLikeCoach(person) ? 'coach' : 'neutral'
  const query =
    intent === 'coach'
      ? `"${person}" manager sideline`
      : `"${person}" football portrait`
  const hits = filterBlockedStockImages(
    await searchSerpApiGoogleImages(query, { limit: 8, signal: opts.signal }),
  ).slice(0, 5)
  console.info('[eof-serpapi] secondary pool', person, `kept=${hits.length}`, '(+1 credit)')
  if (!hits.length) return null
  return {
    subject: person,
    query,
    intent,
    source: 'serpapi',
    hits: hits.map((h) => ({
      url: h.url,
      title: h.title || null,
      width: h.width,
      height: h.height,
    })),
  }
}

/**
 * Claim a unique URL from a SerpAPI job pool (reuses Oxylabs ranking helpers).
 * @param {Parameters<typeof claimOxylabsPoolHit>[0]} opts
 */
export function claimSerpApiPoolHit(opts = {}) {
  return claimOxylabsPoolHit({ ...opts, keyPrefix: 'serpapi' })
}

/**
 * Status for Production UI — account check (no search credit).
 * @returns {Promise<{ configured: boolean, ok: boolean, status?: number, detail?: string }>}
 */
export async function probeEofSerpApi() {
  const apiKey = getSerpApiKey()
  if (!apiKey) {
    return { configured: false, ok: false, detail: 'SERPAPI_API_KEY not set' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const url = new URL(SERPAPI_ACCOUNT_URL)
    url.searchParams.set('api_key', apiKey)
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (res.status === 401 || res.status === 403) {
      return {
        configured: true,
        ok: false,
        status: res.status,
        detail: 'Unauthorized — API key rejected. Re-copy from https://serpapi.com/manage-api-key',
      }
    }
    if (!res.ok) {
      return {
        configured: true,
        ok: false,
        status: res.status,
        detail: `Account API error HTTP ${res.status}`,
      }
    }
    const data = await res.json().catch(() => ({}))
    const plan = data?.plan_name || data?.plan || null
    const left = data?.total_searches_left ?? data?.searches_left
    const leftNote =
      left != null && Number.isFinite(Number(left)) ? `, ${Number(left)} searches left` : ''
    return {
      configured: true,
      ok: true,
      status: res.status,
      detail: plan ? `auth ok (${plan}${leftNote})` : `auth ok (Google Images ready${leftNote})`,
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
