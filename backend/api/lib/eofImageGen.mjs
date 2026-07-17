/**
 * EOF parallel image generation orchestration (Grok Imagine + free Pollinations).
 *
 * Scrape (SerpAPI/Oxylabs) stays the primary reality source.
 * Gen runs in parallel / gapfill and merges into the job pool before vision re-rank.
 */
import { detectImageRoleIntent, resolveImageSubject } from '../../../shared/eofSceneImageQueries.mjs'
import { buildEofImageGenPrompt } from './eofImageGenPrompt.mjs'
import { isEofGrokImagineConfigured, fetchEofGrokImaginePool } from './eofGrokImagineImages.mjs'
import { isEofFreeGenConfigured, fetchEofFreeGenPool } from './eofFreeGenImages.mjs'

export { buildEofImageGenPrompt }

export const EOF_IMAGE_GEN_SOURCES = new Set(['grok-imagine', 'free-gen'])
export const EOF_IMAGE_GEN_MODES = new Set(['off', 'auto', 'always'])
export const EOF_IMAGE_GEN_PROVIDERS = new Set(['auto', 'grok', 'free'])

/** Default cap per Short / rebuild (cost control for Grok quality model). */
export const EOF_IMAGE_GEN_MAX_PER_JOB_DEFAULT = 3

/** Scrape pool is "thin" below this many usable hits (also vs scene count). */
export const EOF_IMAGE_GEN_THIN_POOL_MIN = 3

export function normalizeEofImageGenMode(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (v === 'on') return 'always'
  if (EOF_IMAGE_GEN_MODES.has(v)) return v
  return 'auto'
}

export function normalizeEofImageGenProvider(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
  if (v === 'grok-imagine' || v === 'xai' || v === 'imagine') return 'grok'
  if (v === 'pollinations' || v === 'free-gen' || v === 'free_gen') return 'free'
  if (EOF_IMAGE_GEN_PROVIDERS.has(v)) return v
  return 'auto'
}

export function eofImageGenMaxPerJob(envValue = process.env.EOF_IMAGE_GEN_MAX_PER_JOB) {
  if (envValue == null || String(envValue).trim() === '') return EOF_IMAGE_GEN_MAX_PER_JOB_DEFAULT
  const n = Number(envValue)
  if (!Number.isFinite(n)) return EOF_IMAGE_GEN_MAX_PER_JOB_DEFAULT
  return Math.max(0, Math.min(6, Math.floor(n)))
}

export function isEofImageGenHit(hit) {
  return EOF_IMAGE_GEN_SOURCES.has(String(hit?.source || '').trim())
}

export function isEofScrapeImageHit(hit) {
  const s = String(hit?.source || '').trim()
  if (!s) return true // scrape hits often omit per-hit source (pool-level)
  if (EOF_IMAGE_GEN_SOURCES.has(s)) return false
  return true
}

/**
 * How many gen stills to keep/request for this job.
 * auto = gapfill only when scrape pool is thin after filters.
 * @param {{
 *   mode?: string,
 *   scrapeHitCount?: number,
 *   sceneCount?: number,
 *   maxPerJob?: number,
 * }} opts
 */
export function resolveEofImageGenCount(opts = {}) {
  const mode = normalizeEofImageGenMode(opts.mode)
  const max = eofImageGenMaxPerJob(opts.maxPerJob ?? process.env.EOF_IMAGE_GEN_MAX_PER_JOB)
  if (mode === 'off' || max <= 0) return 0
  if (mode === 'always') return max

  const scrapeHitCount = Math.max(0, Number(opts.scrapeHitCount) || 0)
  const sceneCount = Math.max(1, Number(opts.sceneCount) || 1)
  const thinThreshold = Math.max(EOF_IMAGE_GEN_THIN_POOL_MIN, sceneCount)
  if (scrapeHitCount >= thinThreshold) return 0
  const gap = thinThreshold - scrapeHitCount
  return Math.min(max, Math.max(1, gap))
}

/**
 * Whether auto mode should merge gen into the pool (gapfill).
 */
export function shouldMergeEofImageGen(opts = {}) {
  return resolveEofImageGenCount(opts) > 0
}

/**
 * Ordered gen providers to attempt (first available wins for each slot).
 * auto = Grok then free.
 * @param {string} preferred
 * @param {{ grok?: boolean, free?: boolean }} availability
 */
export function resolveEofImageGenAttemptOrder(preferred, { grok = false, free = false } = {}) {
  const pick = normalizeEofImageGenProvider(preferred)
  const available = []
  if (grok) available.push('grok')
  if (free) available.push('free')
  if (!available.length) return []

  if (pick === 'grok' && grok) {
    return ['grok', ...available.filter((id) => id !== 'grok')]
  }
  if (pick === 'free' && free) {
    return ['free', ...available.filter((id) => id !== 'free')]
  }
  // auto, or preferred missing → Grok first when keyed
  return available
}

export function listEofImageGenModeOptions() {
  return [
    { id: 'off', label: 'Off', detail: 'Scrape / AP / Wikimedia only — no AI stills.' },
    {
      id: 'auto',
      label: 'Auto (gapfill)',
      detail: 'Generate only when the scrape pool is thin after filters (default).',
    },
    {
      id: 'always',
      label: 'Always',
      detail: 'Always generate up to the per-job cap in parallel with scrape.',
    },
  ]
}

export function listEofImageGenProviderOptions() {
  const grok = isEofGrokImagineConfigured()
  const free = isEofFreeGenConfigured()
  return [
    {
      id: 'auto',
      label: 'Auto (Grok → Free)',
      configured: true,
      detail: 'Prefer xAI Grok Imagine when keyed, else Pollinations free Flux.',
    },
    {
      id: 'grok',
      label: 'Grok Imagine',
      configured: grok,
      detail: grok
        ? 'xAI grok-imagine-image-quality (~$0.05/image), 9:16 photorealistic.'
        : 'Add XAI_API_KEY on Vercel staging and redeploy.',
    },
    {
      id: 'free',
      label: 'Free (Pollinations)',
      configured: free,
      detail:
        'Pollinations Flux — no key required. Likeness quality is weaker than Grok for Rooney/Kane.',
    },
  ]
}

export function eofImageGenConfigurationNote({ mode = 'auto', provider = 'auto' } = {}) {
  const m = normalizeEofImageGenMode(mode)
  const p = normalizeEofImageGenProvider(provider)
  if (m === 'off') return 'Image gen: Off — scrape photos only.'
  const grok = isEofGrokImagineConfigured()
  const free = isEofFreeGenConfigured()
  const order = resolveEofImageGenAttemptOrder(p, { grok, free })
  if (!order.length) {
    return 'Image gen: enabled but no provider available (set XAI_API_KEY or leave Free on).'
  }
  const label =
    order[0] === 'grok' ? 'Grok Imagine' : 'Pollinations free'
  const modeLabel = m === 'always' ? 'Always' : 'Auto gapfill'
  return `Image gen: ${modeLabel} via ${label}${order.length > 1 ? ` (fallback: ${order.slice(1).join(', ')})` : ''}.`
}

/**
 * Merge scrape + gen hits. Scrape stays first; gen appended.
 * Vision sort later prefers scrape on equal scores.
 * @param {Array} scrapeHits
 * @param {Array} genHits
 */
export function mergeEofScrapeAndGenHits(scrapeHits, genHits) {
  const scrape = Array.isArray(scrapeHits) ? scrapeHits.filter((h) => h?.url || h?.localPath) : []
  const gen = Array.isArray(genHits) ? genHits.filter((h) => h?.url || h?.localPath) : []
  const seen = new Set()
  const out = []
  for (const hit of [...scrape, ...gen]) {
    const key = String(hit.localPath || hit.url || '').trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out
}

/**
 * Sort hits after vision: higher visionScore first; on tie prefer real scrape over gen.
 * @param {Array<{ url?: string, source?: string, visionScore?: number|null }>} hits
 */
export function sortEofPoolHitsPreferScrape(hits) {
  if (!Array.isArray(hits)) return []
  return [...hits].sort((a, b) => {
    const sa = a.visionScore == null ? 5 : Number(a.visionScore)
    const sb = b.visionScore == null ? 5 : Number(b.visionScore)
    if (sb !== sa) return sb - sa
    const aGen = isEofImageGenHit(a) ? 1 : 0
    const bGen = isEofImageGenHit(b) ? 1 : 0
    return aGen - bGen
  })
}

/**
 * Fetch gen candidates according to mode + provider preference.
 * @param {{
 *   mode?: string,
 *   provider?: string,
 *   subject?: string,
 *   intent?: string,
 *   topic?: string,
 *   workDir: string,
 *   sceneCount?: number,
 *   scrapeHitCount?: number,
 *   maxPerJob?: number,
 *   signal?: AbortSignal,
 * }} opts
 */
export async function fetchEofImageGenPool(opts = {}) {
  const mode = normalizeEofImageGenMode(opts.mode)
  const provider = normalizeEofImageGenProvider(opts.provider)
  const count = resolveEofImageGenCount({
    mode,
    scrapeHitCount: opts.scrapeHitCount,
    sceneCount: opts.sceneCount,
    maxPerJob: opts.maxPerJob,
  })
  if (count <= 0) return []

  const subject =
    String(opts.subject || '').trim() ||
    resolveImageSubject(opts.topic || '') ||
    String(opts.topic || '').trim()
  if (!subject) return []

  const intent =
    opts.intent ||
    detectImageRoleIntent({
      topic: opts.topic,
      plainTextDraft: opts.plainTextDraft,
      intent: opts.intent,
    })

  const order = resolveEofImageGenAttemptOrder(provider, {
    grok: isEofGrokImagineConfigured(),
    free: isEofFreeGenConfigured(),
  })
  if (!order.length) return []

  const common = {
    subject,
    intent,
    topic: opts.topic,
    workDir: opts.workDir,
    signal: opts.signal,
  }

  // Try preferred provider for the full count; fall back for remaining slots.
  const hits = []
  let remaining = count
  for (const id of order) {
    if (remaining <= 0) break
    try {
      const batch =
        id === 'grok'
          ? await fetchEofGrokImaginePool({ ...common, count: remaining })
          : await fetchEofFreeGenPool({ ...common, count: remaining })
      for (const h of batch) {
        hits.push(h)
        remaining -= 1
        if (remaining <= 0) break
      }
    } catch (e) {
      console.warn('[eof-image-gen]', id, 'failed', e instanceof Error ? e.message : e)
    }
  }

  console.info(
    '[eof-image-gen]',
    `mode=${mode}`,
    `provider=${provider}`,
    `wanted=${count}`,
    `got=${hits.length}`,
    `subject=${subject.slice(0, 40)}`,
    `intent=${intent}`,
  )
  return hits
}

/**
 * Start gen in parallel with scrape for `always`; for `auto` wait until scrape count is known.
 * Returns a promise of gen hits (may be empty).
 *
 * @param {{
 *   mode?: string,
 *   provider?: string,
 *   scrapePromise: Promise<{ hits?: Array } | null>,
 *   subject?: string,
 *   intent?: string,
 *   topic?: string,
 *   workDir: string,
 *   sceneCount?: number,
 *   plainTextDraft?: string,
 *   maxPerJob?: number,
 *   signal?: AbortSignal,
 * }} opts
 */
export async function runEofImageGenAlongsideScrape(opts = {}) {
  const mode = normalizeEofImageGenMode(opts.mode)
  if (mode === 'off') {
    await opts.scrapePromise.catch(() => null)
    return []
  }

  const max = eofImageGenMaxPerJob(opts.maxPerJob ?? process.env.EOF_IMAGE_GEN_MAX_PER_JOB)
  const base = {
    mode,
    provider: opts.provider,
    subject: opts.subject,
    intent: opts.intent,
    topic: opts.topic,
    workDir: opts.workDir,
    sceneCount: opts.sceneCount,
    plainTextDraft: opts.plainTextDraft,
    maxPerJob: max,
    signal: opts.signal,
  }

  if (mode === 'always') {
    // True parallel: generate while scrape runs.
    const [, gen] = await Promise.all([
      opts.scrapePromise.catch(() => null),
      fetchEofImageGenPool({ ...base, scrapeHitCount: 0 }),
    ])
    return gen
  }

  // auto gapfill: wait for scrape so we only spend Grok credits when the pool is thin.
  // Kick a single free-gen in parallel (no cost) so gapfill stays snappy when needed.
  const provider = normalizeEofImageGenProvider(opts.provider)
  const freeWarm =
    isEofFreeGenConfigured() && (provider === 'free' || provider === 'auto')
      ? fetchEofFreeGenPool({
          subject: opts.subject || resolveImageSubject(opts.topic || '') || opts.topic,
          intent: opts.intent,
          topic: opts.topic,
          workDir: opts.workDir,
          count: 1,
          signal: opts.signal,
        }).catch((e) => {
          console.warn('[eof-image-gen] free warm failed', e instanceof Error ? e.message : e)
          return []
        })
      : Promise.resolve([])

  const scrape = await opts.scrapePromise.catch(() => null)
  const scrapeHitCount = Array.isArray(scrape?.hits) ? scrape.hits.length : 0
  const need = resolveEofImageGenCount({
    mode: 'auto',
    scrapeHitCount,
    sceneCount: opts.sceneCount,
    maxPerJob: max,
  })
  if (need <= 0) {
    freeWarm.catch(() => {})
    return []
  }

  const freeHits = await freeWarm
  const hits = [...freeHits]
  if (hits.length >= need) return hits.slice(0, need)

  // Prefer Grok for remaining slots when auto/grok and keyed.
  const order = resolveEofImageGenAttemptOrder(provider, {
    grok: isEofGrokImagineConfigured(),
    free: isEofFreeGenConfigured(),
  })
  const remaining = need - hits.length
  if (remaining > 0 && order.includes('grok')) {
    const grokHits = await fetchEofGrokImaginePool({
      subject: opts.subject || resolveImageSubject(opts.topic || '') || opts.topic,
      intent: opts.intent,
      topic: opts.topic,
      workDir: opts.workDir,
      count: remaining,
      signal: opts.signal,
    }).catch((e) => {
      console.warn('[eof-image-gen] grok gapfill failed', e instanceof Error ? e.message : e)
      return []
    })
    hits.push(...grokHits)
  }
  if (hits.length < need && order.includes('free') && freeHits.length === 0) {
    const moreFree = await fetchEofFreeGenPool({
      subject: opts.subject || resolveImageSubject(opts.topic || '') || opts.topic,
      intent: opts.intent,
      topic: opts.topic,
      workDir: opts.workDir,
      count: need - hits.length,
      signal: opts.signal,
    }).catch(() => [])
    hits.push(...moreFree)
  }

  return hits.slice(0, need)
}
