import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  EOF_PRODUCTION_JOB_STATUS,
  buildEofRenderProgress,
  estimateEofVideoRenderDurationSec,
} from '../../../shared/eofProduction.mjs'
import { estimateCaptionDurationSec } from '../../../shared/eofScriptTemplates.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  markEofProductionJobFailed,
  updateEofProductionRenderProgress,
} from './eofProductionJobs.mjs'
import { eofProductionWorkDir } from './eofSceneTts.mjs'
import { fetchEofSceneImage, clearEofSceneImageCache } from './eofSceneImages.mjs'
import { listWikimediaPersonImages } from './eofWikimediaImages.mjs'
import {
  isEofOxylabsConfigured,
  fetchEofOxylabsJobPool,
  fetchEofOxylabsSecondaryPool,
} from './eofOxylabsImages.mjs'
import {
  isEofSerpApiConfigured,
  fetchEofSerpApiJobPool,
  fetchEofSerpApiSecondaryPool,
} from './eofSerpApiImages.mjs'
import {
  isEofImageVisionConfigured,
  rankEofPoolHitsWithVision,
  applyVisionScoresToHits,
  applyVisionScoresWithNameCueFallback,
} from './eofImageVision.mjs'
import {
  resolveImageSubject,
  listSecondaryImageSubjects,
  detectImageRoleIntent,
  filterHitsRequiringSubjectNameCue,
  isNamedFootballSubject,
} from '../../../shared/eofSceneImageQueries.mjs'
import { resolveEofOverlayMoments } from '../../../shared/eofOverlayMoments.mjs'
import {
  applyEofShortQualityGateToJob,
  applyEofShortQualityPreflightToJob,
  applyEofShortQualityStillsPreflightToJob,
  EofQualityGateBlockedError,
} from './eofShortQualityGateApply.mjs'
import {
  getEofImageProviderSettings,
  normalizeEofImageProvider,
  resolveEofImageProviderAttemptOrder,
} from './eofImageProviderSettings.mjs'
import {
  normalizeEofImageGenMode,
  normalizeEofImageGenProvider,
  mergeEofScrapeAndGenHits,
  runEofImageGenAlongsideScrape,
  sortEofPoolHitsPreferScrape,
} from './eofImageGen.mjs'
import { renderEofProductionVideo, eofProductionVideoRelPath, eofProductionVideoAbsPath, clearEofSceneClipCache, assertEofCleanPlateImagePath } from './eofProductionVideo.mjs'
import {
  mapWithConcurrency,
  createThrottledWriter,
  startProgressHeartbeat,
  withDeadline,
} from './eofAsyncPool.mjs'
import {
  ensureEofMixedAudioOnDisk,
  persistEofVideoArtifact,
  saveEofSceneImagesArtifact,
  ensureEofSceneImageOnDisk,
  clearEofVideoArtifact,
  clearEofVideoOnlyArtifact,
} from './eofProductionArtifacts.mjs'
import {
  isEofForceSlim,
  capEofScriptScenesForServerless,
  eofServerlessSlimRenderOpts,
} from './eofProductionServerless.mjs'
import { isEofSlimBuildEnabled } from './eofBuildModeSettings.mjs'

const IMAGE_CONCURRENCY = Number(process.env.EOF_IMAGE_CONCURRENCY) || 3
/** Cap whole scrape+vision+gen phase so builds fail fast instead of freezing the UI. */
const IMAGE_POOL_DEADLINE_MS =
  Number(process.env.EOF_IMAGE_POOL_DEADLINE_MS) ||
  (isEofForceSlim() ? 50_000 : 70_000)
/** Cap per-scene download / slow fallback waterfall after the Serp pool. */
const SCENE_ASSIGN_DEADLINE_MS =
  Number(process.env.EOF_SCENE_ASSIGN_DEADLINE_MS) ||
  (isEofForceSlim() ? 60_000 : 75_000)
/** Cap ffmpeg scene clips + mux so UI never sits forever. Pro gets a longer budget. */
const VIDEO_ENCODE_DEADLINE_MS =
  Number(process.env.EOF_VIDEO_ENCODE_DEADLINE_MS) ||
  (isEofForceSlim() ? 140_000 : 210_000)
/** Per-scene history length — keep ≥20 rebuilds of avoidKeys before oldest URLs can repeat. */
export const EOF_IMAGE_KEY_HISTORY_LIMIT = 32

/** True when prior stills were placeholders — Rebuild must not treat them as reusable history. */
export function priorStillsWerePlaceholders(manifest) {
  const rows = Array.isArray(manifest) ? manifest : []
  if (!rows.length) return false
  const withSource = rows.filter((m) => m && (m.imageSource || m.imageKey))
  if (!withSource.length) return false
  return withSource.every((m) => String(m.imageSource || '').startsWith('placeholder'))
}

/**
 * Remux / remix / reuse-stills paths must not re-run stills preflight
 * (stale clickbait/pop metadata must not block audio/captions/effects remux).
 * @param {{ skipStillsPreflight?: boolean, reuseSceneImages?: boolean }} [opts]
 */
export function shouldSkipEofStillsPreflight(opts = {}) {
  return opts.skipStillsPreflight === true || opts.reuseSceneImages === true
}

/**
 * Remux / remix paths skip plan preflight (already ran on the original Build).
 * @param {{ skipPlanPreflight?: boolean }} [opts]
 */
export function shouldSkipEofPlanPreflight(opts = {}) {
  return opts.skipPlanPreflight === true
}

/**
 * User-facing error when every scene fell back to placeholders.
 * Names each Google Images provider tried (auth vs empty vs filtered) — not only Wikimedia.
 *
 * @param {{
 *   topic?: string,
 *   providerOrder?: string[],
 *   providerAttempts?: Array<{ provider: string, status?: string, detail?: string, hits?: number, query?: string }>,
 *   scrapeHitsBeforeFilter?: number,
 *   scrapeHitsAfterFilter?: number,
 *   wikiHits?: number,
 *   genHits?: number,
 *   subject?: string|null,
 * }} [info]
 */
export function formatEofNoSceneImagesError(info = {}) {
  const topic = String(info.topic || 'this topic').trim() || 'this topic'
  const subject = String(info.subject || '').trim()
  const parts = []
  const order = Array.isArray(info.providerOrder) ? info.providerOrder : []
  const attempts = Array.isArray(info.providerAttempts) ? info.providerAttempts : []

  if (!order.length && !attempts.length) {
    parts.push('SerpAPI was not configured (missing SERPAPI_API_KEY)')
  } else {
    for (const provider of order.length ? order : attempts.map((a) => a.provider)) {
      const a = attempts.find((x) => x.provider === provider)
      if (!a) {
        parts.push(`${provider}: not attempted`)
        continue
      }
      const status = String(a.status || 'unknown')
      if (status === 'auth_failed') {
        parts.push(
          provider === 'oxylabs'
            ? 'Oxylabs auth failed (check OXYLABS_USERNAME / OXYLABS_PASSWORD on Vercel)'
            : 'SerpAPI auth failed (check SERPAPI_API_KEY on Vercel)',
        )
      } else if (status === 'not_configured') {
        parts.push(
          provider === 'oxylabs'
            ? 'Oxylabs not configured (need OXYLABS_ENABLED=1 + OXYLABS_USERNAME / OXYLABS_PASSWORD)'
            : 'SerpAPI not configured (SERPAPI_API_KEY)',
        )
      } else if (status === 'ok' && Number(a.hits) > 0) {
        parts.push(`${provider}: returned ${a.hits} hit(s) then post-filter emptied the pool`)
      } else if (status === 'empty' || Number(a.hits) === 0) {
        parts.push(`${provider}: ${a.detail || '0 usable image URLs'}`)
      } else {
        parts.push(`${provider}: ${status}${a.detail ? ` — ${a.detail}` : ''}`)
      }
    }
  }

  const before = Number(info.scrapeHitsBeforeFilter)
  const after = Number(info.scrapeHitsAfterFilter)
  if (Number.isFinite(before) && before > 0 && Number.isFinite(after) && after === 0) {
    parts.push(
      `subject-name/vision filter dropped all ${before} scrape hit(s)${
        subject ? ` for “${subject}”` : ''
      }`,
    )
  }

  if (info.wikiHits != null && Number.isFinite(Number(info.wikiHits))) {
    const wikiHits = Number(info.wikiHits)
    parts.push(
      wikiHits > 0
        ? `Wikimedia: ${wikiHits} candidate(s) but none downloaded`
        : 'Wikimedia/Commons: nothing usable',
    )
  }

  const genHits = Number(info.genHits)
  if (Number.isFinite(genHits) && genHits > 0) {
    parts.push(`AI gen produced ${genHits} still(s) but none were usable for scenes`)
  }

  const tried = parts.length ? parts.join('; ') : 'no image sources produced usable stills'
  return `No real scene images could be downloaded for “${topic}”. Tried: ${tried}. Check server logs / Vercel env, then Rebuild video again.`
}

/**
 * Canonical remux video opts — reuse stills, skip both preflight phases.
 * @param {{ captionMode?: 'auto'|'free'|'zapcap-only', includeAudioIfPresent?: boolean }} [extra]
 */
export function eofRemuxVideoJobOpts(extra = {}) {
  return {
    includeAudioIfPresent: extra.includeAudioIfPresent !== false,
    reuseSceneImages: true,
    captionMode:
      extra.captionMode === 'zapcap-only'
        ? 'zapcap-only'
        : extra.captionMode === 'auto'
          ? 'auto'
          : 'free',
    skipPlanPreflight: true,
    skipStillsPreflight: true,
  }
}

/** Append a used image key; newest last, capped for durable narrationManifest size. */
export function appendEofImageKeyHistory(priorHistory, imageKey, limit = EOF_IMAGE_KEY_HISTORY_LIMIT) {
  const prior = Array.isArray(priorHistory) ? priorHistory.filter(Boolean) : []
  const key = String(imageKey || '').trim()
  if (!key) return prior.slice(-Math.max(1, limit))
  return [...prior.filter((k) => k !== key), key].slice(-Math.max(1, Number(limit) || EOF_IMAGE_KEY_HISTORY_LIMIT))
}

/**
 * Strip per-scene Serp avoid history from a narrationManifest (keep TTS line hashes).
 * After ~N Rebuilds a poisoned job can hold 32 avoided CDN keys and exhaust the pool
 * even when Build Short resets ttsSynthCount — explicit human Build / Reset must wipe these.
 * @param {unknown} manifest
 */
export function clearEofImageAvoidHistoryFromManifest(manifest) {
  if (!Array.isArray(manifest)) return manifest ?? null
  return manifest.map((row) => {
    if (!row || typeof row !== 'object') return row
    const next = { ...row, imageAttempt: 0, imageKeyHistory: [] }
    if (String(row.imageSource || '').startsWith('placeholder')) {
      next.imageKey = null
      next.imageSource = null
      next.imageUrl = null
      next.imageTitle = null
    }
    return next
  })
}

/**
 * Explicit Build / Rebuild must clear avoidKeys — not only when prior stills were placeholders.
 * Placeholder-only wipe left Cucurella poisoned after ~40 real Serp claims then encode/stale fails.
 * @param {{ reuseSceneImages?: boolean, forceFreshImages?: boolean }} opts
 * @param {unknown} priorManifest
 */
export function shouldForceFreshEofSceneImages(opts = {}, priorManifest) {
  if (opts.reuseSceneImages === true) return false
  if (opts.forceFreshImages === true) return true
  return priorStillsWerePlaceholders(priorManifest)
}

/**
 * After encode: require durable video_base64 (or fail the job — never leave video_rendered empty).
 * @param {{ saved?: boolean, bytes?: number, recompressed?: boolean }} persisted
 */
export function assertEofVideoPersisted(persisted) {
  if (persisted?.saved) return persisted
  const bytes = Number(persisted?.bytes) || 0
  const mb = (bytes / (1024 * 1024)).toFixed(1)
  throw new Error(
    `Short rendered but could not be stored for preview (${mb}MB after compression). Rebuild video, or shorten the voiceover.`,
  )
}

/**
 * Build 9:16 Short MP4 from script scenes: stock images + on-screen captions.
 * Audio is optional (legacy path). Image-only Shorts are the default.
 * @param {string} jobId
 * @param {{
 *   includeAudioIfPresent?: boolean,
 *   reuseSceneImages?: boolean,
 *   captionMode?: 'auto' | 'free' | 'zapcap-only',
 *   imageProvider?: string | null,
 *   qualityGateMode?: 'auto' | 'manual',
 *   skipPlanPreflight?: boolean,
 *   skipStillsPreflight?: boolean,
 *   forceFreshImages?: boolean,
 * }} [opts]
 */
export async function renderEofProductionVideoJob(jobId, opts = {}) {
  const includeAudioIfPresent = opts.includeAudioIfPresent === true
  const reuseSceneImages = opts.reuseSceneImages === true
  // Remux / remix / effects reuse cached stills — skip stills gate (stale clickbait pop
  // metadata must not block audio-only or captions-only remux).
  const skipStillsPreflight = shouldSkipEofStillsPreflight(opts)
  const skipPlanPreflight = shouldSkipEofPlanPreflight(opts)
  const captionMode =
    opts.captionMode === 'zapcap-only' ? 'zapcap-only' : opts.captionMode === 'auto' ? 'auto' : 'free'
  const imageProviderOverride =
    opts.imageProvider !== undefined && opts.imageProvider !== null && String(opts.imageProvider).trim()
      ? normalizeEofImageProvider(opts.imageProvider)
      : null
  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'
  let job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  // Fresh video builds on Hobby/slim: cap scenes so encode finishes under maxDuration.
  // Remux paths keep existing still count (reuseSceneImages).
  const slimBuild = await isEofSlimBuildEnabled()
  if (slimBuild && !reuseSceneImages && job.script?.scenes?.length) {
    const capped = capEofScriptScenesForServerless(job.script)
    if (capped.trimmed) {
      console.warn(
        `[eof-video] capping scenes ${capped.before}→${capped.after} for slim/Hobby encode`,
        jobId,
      )
      job = await updateEofProductionJob(jobId, { script: capped.script })
    }
  }

  const scriptScenes = job.script?.scenes || []
  if (!scriptScenes.length) {
    throw new Error('Job has no script scenes — write a script first.')
  }

  // Plan-time gate before any image API / ffmpeg work (skipped when caller already ran it).
  if (!skipPlanPreflight) {
    await applyEofShortQualityPreflightToJob(jobId, {
      mode: qualityGateMode,
      blockOnFail: true,
    })
  }

  const workDir = eofProductionWorkDir(jobId)

  let mixedPath = null
  if (includeAudioIfPresent) {
    mixedPath = (await ensureEofMixedAudioOnDisk(jobId)) || join(workDir, 'mixed.mp3')
    if (!existsSync(mixedPath)) mixedPath = null
  }

  const sceneCount = scriptScenes.length
  const renderStartedAt = new Date().toISOString()
  const estimatedTotalSec = estimateEofVideoRenderDurationSec(sceneCount)

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
    errorMessage: null,
    qualityGate: null,
  })

  const throttledProgress = createThrottledWriter(
    (progress) => updateEofProductionRenderProgress(jobId, progress),
    700,
  )

  async function report(stage, sceneIndex = 0, { force = false, message } = {}) {
    await throttledProgress(
      buildEofRenderProgress({
        stage,
        sceneIndex,
        sceneCount,
        startedAt: renderStartedAt,
        estimatedTotalSec,
        pipeline: 'video',
        message,
      }),
      { force },
    )
  }

  try {
    // Drop prior durable MP4 (and stills when refreshing) so a failed rebuild cannot leave
    // status=video_rendered with an empty/stale video_base64 from a half-written path.
    // Also wipe clip-*.mp4 + caption-text dirs so remux never reuses a captioned plate.
    if (reuseSceneImages) {
      await clearEofVideoOnlyArtifact(jobId).catch(() => {})
      clearEofSceneClipCache(workDir)
    } else {
      await clearEofVideoArtifact(jobId).catch(() => {})
      clearEofSceneImageCache(workDir)
      clearEofSceneClipCache(workDir)
    }

    await report(reuseSceneImages ? 'video' : 'images', 0, { force: true })

    const priorManifest = Array.isArray(job.narrationManifest) ? job.narrationManifest : []
    const rows = scriptScenes.map((s, i) => {
      const caption = String(s.caption || s.narration || '').trim()
      const prior = priorManifest.find((m) => m.index === i) || priorManifest[i]
      const durationSec =
        Number(prior?.durationSec) || Number(s.durationSec) || estimateCaptionDurationSec(caption)
      return {
        index: i,
        durationSec,
        caption,
        narration: String(s.narration || s.caption || caption).trim(),
        imageQuery: s.imageQuery,
      }
    })

    let imagesDone = 0
    // Google Images pool: exactly ONE billable query for the whole Short.
    // Order follows admin imageProvider (auto / serpapi / oxylabs opt-in), then AP/CSE per scene.
    let oxyPool = null
    let wikiPool = []
    /** @type {{ providerOrder: string[], providerAttempts: Array<{ provider: string, status?: string, detail?: string, hits?: number, query?: string }>, scrapeHitsBeforeFilter: number, scrapeHitsAfterFilter: number, wikiHits: number|null, genHits: number, subject: string|null }} */
    const imageFetchDiag = {
      providerOrder: [],
      providerAttempts: [],
      scrapeHitsBeforeFilter: 0,
      scrapeHitsAfterFilter: 0,
      wikiHits: null,
      genHits: 0,
      subject: null,
    }
    if (!reuseSceneImages) {
      const maxAttempt = Math.max(
        0,
        ...priorManifest.map((m) => Number(m?.imageAttempt) || 0),
      )
      const imageSettings = await getEofImageProviderSettings().catch(() => ({
        imageProvider: 'auto',
        imageGenMode: 'auto',
        imageGenProvider: 'auto',
      }))
      // Per-build override (Production UI Build / Rebuild) wins over the saved admin default.
      const preferredProvider = imageProviderOverride || imageSettings.imageProvider || 'auto'
      const imageGenMode = normalizeEofImageGenMode(
        process.env.EOF_IMAGE_GEN_MODE || imageSettings.imageGenMode || 'auto',
      )
      const imageGenProvider = normalizeEofImageGenProvider(
        process.env.EOF_IMAGE_GEN_PROVIDER || imageSettings.imageGenProvider || 'auto',
      )
      const providerOrder = resolveEofImageProviderAttemptOrder(preferredProvider, {
        serpapi: isEofSerpApiConfigured(),
        oxylabs: isEofOxylabsConfigured(),
      })
      imageFetchDiag.providerOrder = [...providerOrder]
      console.info(
        '[eof-video] image provider',
        preferredProvider,
        imageProviderOverride ? '(build override)' : '(saved default)',
        '→',
        providerOrder.join(' → ') || '(none keyed)',
        `| gen=${imageGenMode}/${imageGenProvider}`,
        `| topic=${String(job.topic || '').slice(0, 80)}`,
        `| subject=${String(resolveImageSubject(job.topic) || '').slice(0, 40)}`,
      )
      const imageContext = {
        plainTextDraft: String(job.script?.plainTextDraft || '').trim(),
        captions: rows.map((r) => r.caption).filter(Boolean),
      }
      const leadSubject = resolveImageSubject(job.topic) || String(job.topic || '').trim()
      imageFetchDiag.subject = leadSubject || null
      const leadIntent = detectImageRoleIntent({
        topic: job.topic,
        plainTextDraft: imageContext.plainTextDraft,
        captions: imageContext.captions,
      })

      async function fetchScrapeJobPool() {
        let pool = null
        for (const provider of providerOrder) {
          if (pool?.hits?.length) break
          if (provider === 'serpapi') {
            try {
              const scraped = await fetchEofSerpApiJobPool({
                topic: job.topic,
                sceneCount: rows.length,
                attempt: maxAttempt,
                ...imageContext,
              })
              const hitCount = scraped.hits?.length || 0
              imageFetchDiag.providerAttempts.push({
                provider: 'serpapi',
                status: scraped.health?.status || (hitCount ? 'ok' : 'empty'),
                detail: scraped.healthNote || scraped.health?.detail || '',
                hits: hitCount,
                query: scraped.query || '',
              })
              if (scraped.healthNote || scraped.health?.softFallback) {
                console.warn(
                  '[eof-video] serpapi pool soft-fallback',
                  scraped.health?.status || 'unknown',
                  scraped.healthNote || scraped.health?.detail || '',
                )
              }
              if (hitCount) {
                pool = {
                  query: scraped.query,
                  hits: scraped.hits.map((h) => ({ ...h, source: h.source || 'serpapi' })),
                  claimed: new Set(),
                  source: 'serpapi',
                  plainTextDraft: imageContext.plainTextDraft,
                  intent: scraped.intent || leadIntent || null,
                  subject: scraped.subject || leadSubject || null,
                  health: scraped.health || null,
                }
              }
            } catch (e) {
              const detail = e instanceof Error ? e.message : String(e)
              console.warn('[eof-video] serpapi job pool failed', detail)
              imageFetchDiag.providerAttempts.push({
                provider: 'serpapi',
                status: 'error',
                detail,
                hits: 0,
              })
            }
            continue
          }
          if (provider === 'oxylabs') {
            try {
              const scraped = await fetchEofOxylabsJobPool({
                topic: job.topic,
                sceneCount: rows.length,
                attempt: maxAttempt,
                ...imageContext,
              })
              const hitCount = scraped.hits?.length || 0
              imageFetchDiag.providerAttempts.push({
                provider: 'oxylabs',
                status: scraped.health?.status || (hitCount ? 'ok' : 'empty'),
                detail: scraped.healthNote || scraped.health?.detail || '',
                hits: hitCount,
                query: scraped.query || '',
              })
              if (scraped.healthNote || scraped.health?.softFallback) {
                console.warn(
                  '[eof-video] oxylabs pool soft-fallback',
                  scraped.health?.status || 'unknown',
                  scraped.healthNote || scraped.health?.detail || '',
                )
              }
              if (hitCount) {
                pool = {
                  query: scraped.query,
                  hits: scraped.hits.map((h) => ({ ...h, source: h.source || 'oxylabs' })),
                  claimed: new Set(),
                  source: 'oxylabs',
                  plainTextDraft: imageContext.plainTextDraft,
                  intent: scraped.intent || leadIntent || null,
                  subject: scraped.subject || leadSubject || null,
                  health: scraped.health || null,
                }
              }
            } catch (e) {
              const detail = e instanceof Error ? e.message : String(e)
              console.warn('[eof-video] oxylabs job pool failed', detail)
              imageFetchDiag.providerAttempts.push({
                provider: 'oxylabs',
                status: 'error',
                detail,
                hits: 0,
              })
            }
          }
        }
        return pool
      }

      let imagePhaseNote = 'Searching Google Images (SerpAPI)…'
      const stopImageHb = startProgressHeartbeat(async () => {
        await report('images', 0, { force: true, message: imagePhaseNote })
      }, 3500)
      try {
        await report('images', 0, { force: true, message: imagePhaseNote })

        const poolWork = (async () => {
          const scrapePromise = fetchScrapeJobPool()
          const genPromise = runEofImageGenAlongsideScrape({
            mode: imageGenMode,
            provider: imageGenProvider,
            scrapePromise,
            subject: leadSubject,
            intent: leadIntent,
            topic: job.topic,
            workDir,
            sceneCount: rows.length,
            plainTextDraft: imageContext.plainTextDraft,
          })

          const [scrapePool, genHits] = await Promise.all([scrapePromise, genPromise])
          oxyPool = scrapePool
          imageFetchDiag.scrapeHitsBeforeFilter = oxyPool?.hits?.length || 0
          imageFetchDiag.genHits = Array.isArray(genHits) ? genHits.length : 0

          if (Array.isArray(genHits) && genHits.length) {
            if (oxyPool?.hits?.length) {
              oxyPool.hits = mergeEofScrapeAndGenHits(oxyPool.hits, genHits)
            } else {
              oxyPool = {
                query: `ai-gen:${leadSubject}`,
                hits: mergeEofScrapeAndGenHits([], genHits),
                claimed: new Set(),
                source: genHits[0]?.source || 'grok-imagine',
                plainTextDraft: imageContext.plainTextDraft,
                intent: leadIntent || null,
                subject: leadSubject || null,
              }
            }
            console.info(
              '[eof-video] image gen merged',
              `${genHits.length} gen hits`,
              `pool=${oxyPool.hits.length}`,
              `mode=${imageGenMode}`,
            )
          }

          // Second credit only when the script names another person (Rooney + Tuchel).
          const secondaryPeople = listSecondaryImageSubjects(
            job.topic,
            imageContext.plainTextDraft,
          )
          if (
            oxyPool?.hits?.length &&
            secondaryPeople.length &&
            (oxyPool.source === 'serpapi' || oxyPool.source === 'oxylabs')
          ) {
            imagePhaseNote = 'Fetching secondary person stills…'
            try {
              const sec =
                oxyPool.source === 'serpapi'
                  ? await fetchEofSerpApiSecondaryPool({
                      topic: job.topic,
                      plainTextDraft: imageContext.plainTextDraft,
                    })
                  : await fetchEofOxylabsSecondaryPool({
                      topic: job.topic,
                      plainTextDraft: imageContext.plainTextDraft,
                    })
              if (sec?.hits?.length) {
                oxyPool.secondaryHits = sec.hits.map((h) => ({
                  ...h,
                  source: h.source || oxyPool.source,
                }))
                oxyPool.secondarySubject = sec.subject
                oxyPool.secondaryQuery = sec.query
                oxyPool.secondaryClaimed = new Set()
              }
            } catch (e) {
              console.warn('[eof-video] secondary image pool failed', e instanceof Error ? e.message : e)
            }
          }

          // Grok vision: look at the stills (not just titles) — drop watermark / wrong era / wrong face.
          // Prefer real scrape photos when vision scores tie (applyVisionScoresToHits).
          // When vision is off/failed: NEVER take the first Google hit for a celebrity — require name cues.
          if (oxyPool?.hits?.length && isEofImageVisionConfigured()) {
            imagePhaseNote = 'Scoring stills with vision…'
            await report('images', 0, { force: true, message: imagePhaseNote })
            try {
              const visionScores = await rankEofPoolHitsWithVision({
                hits: oxyPool.hits,
                subject: oxyPool.subject || leadSubject || job.topic,
                intent: oxyPool.intent || leadIntent || 'neutral',
                secondarySubjects: secondaryPeople,
                maxImages: Math.min(8, oxyPool.hits.length),
              })
              if (visionScores.size) {
                // Fallback keeps query-named empty-title stills if vision rejects everything
                // (Cucurella empty-title CDN thumbs) so the pool is never wiped to a hard fail.
                oxyPool.hits = applyVisionScoresWithNameCueFallback(
                  oxyPool.hits,
                  oxyPool.subject || leadSubject,
                  visionScores,
                  { query: oxyPool.query || '' },
                )
                console.info(
                  '[eof-video] vision kept',
                  oxyPool.hits.length,
                  'stills for',
                  String(oxyPool.subject || leadSubject || '').slice(0, 40),
                )
              } else if (isNamedFootballSubject(leadSubject)) {
                console.warn(
                  '[eof-video] vision returned no scores — strict subject-name filter for',
                  String(leadSubject).slice(0, 40),
                )
                oxyPool.hits = filterHitsRequiringSubjectNameCue(
                  oxyPool.hits,
                  oxyPool.subject || leadSubject,
                  { query: oxyPool.query || '' },
                )
                oxyPool.hits = sortEofPoolHitsPreferScrape(oxyPool.hits)
              } else {
                oxyPool.hits = sortEofPoolHitsPreferScrape(oxyPool.hits)
              }
              if (oxyPool.secondaryHits?.length) {
                const secScores = await rankEofPoolHitsWithVision({
                  hits: oxyPool.secondaryHits,
                  subject: oxyPool.secondarySubject || secondaryPeople[0],
                  intent: 'coach',
                  maxImages: Math.min(6, oxyPool.secondaryHits.length),
                })
                if (secScores.size) {
                  oxyPool.secondaryHits = applyVisionScoresToHits(oxyPool.secondaryHits, secScores)
                } else if (isNamedFootballSubject(oxyPool.secondarySubject || secondaryPeople[0])) {
                  oxyPool.secondaryHits = filterHitsRequiringSubjectNameCue(
                    oxyPool.secondaryHits,
                    oxyPool.secondarySubject || secondaryPeople[0],
                    { query: oxyPool.secondaryQuery || '' },
                  )
                }
              }
            } catch (e) {
              console.warn('[eof-video] vision re-rank skipped', e instanceof Error ? e.message : e)
              if (isNamedFootballSubject(leadSubject)) {
                oxyPool.hits = filterHitsRequiringSubjectNameCue(
                  oxyPool.hits,
                  oxyPool.subject || leadSubject,
                  { query: oxyPool.query || '' },
                )
              }
              oxyPool.hits = sortEofPoolHitsPreferScrape(oxyPool.hits)
            }
          } else if (oxyPool?.hits?.length) {
            if (isNamedFootballSubject(leadSubject)) {
              console.warn(
                '[eof-video] vision not configured — strict subject-name filter for',
                String(leadSubject).slice(0, 40),
              )
              oxyPool.hits = filterHitsRequiringSubjectNameCue(
                oxyPool.hits,
                oxyPool.subject || leadSubject,
                { query: oxyPool.query || '' },
              )
              if (oxyPool.secondaryHits?.length && oxyPool.secondarySubject) {
                oxyPool.secondaryHits = filterHitsRequiringSubjectNameCue(
                  oxyPool.secondaryHits,
                  oxyPool.secondarySubject,
                  { query: oxyPool.secondaryQuery || '' },
                )
              }
            }
            oxyPool.hits = sortEofPoolHitsPreferScrape(oxyPool.hits)
          }

          imageFetchDiag.scrapeHitsAfterFilter = oxyPool?.hits?.length || 0
          console.info(
            '[eof-video] google images pool',
            oxyPool?.source || 'none',
            oxyPool?.hits?.length ? `${oxyPool.hits.length} hits` : '0 hits',
            oxyPool?.secondaryHits?.length ? `+${oxyPool.secondaryHits.length} secondary` : '',
            oxyPool?.query ? `q=${String(oxyPool.query).slice(0, 80)}` : '',
            imageFetchDiag.scrapeHitsBeforeFilter > imageFetchDiag.scrapeHitsAfterFilter
              ? `(filtered ${imageFetchDiag.scrapeHitsBeforeFilter}→${imageFetchDiag.scrapeHitsAfterFilter})`
              : '',
          )
          if (
            imageFetchDiag.scrapeHitsBeforeFilter > 0 &&
            imageFetchDiag.scrapeHitsAfterFilter === 0
          ) {
            console.warn(
              `eof:serp pool emptied after subject/vision filter subject=${String(leadSubject || '').slice(0, 40)} before=${imageFetchDiag.scrapeHitsBeforeFilter}`,
            )
          }
          if (!oxyPool?.hits?.length) {
            imagePhaseNote = 'Searching Wikimedia Commons…'
            await report('images', 0, { force: true, message: imagePhaseNote })
            // Wikidata only when no Google Images job pool is available.
            try {
              wikiPool = await listWikimediaPersonImages(job.topic, {
                limit: Math.max(8, rows.length + 3),
              })
            } catch (e) {
              console.warn(
                '[eof-video] wikimedia person pool failed',
                job.topic,
                e instanceof Error ? e.message : e,
              )
              wikiPool = []
            }
            imageFetchDiag.wikiHits = Array.isArray(wikiPool) ? wikiPool.length : 0
          }
        })()

        await withDeadline(poolWork, IMAGE_POOL_DEADLINE_MS, 'Image search')
      } finally {
        stopImageHb()
      }
    }

    // Explicit Build / Rebuild (opts.forceFreshImages) OR prior placeholders → clear avoidKeys.
    // Placeholder-only was not enough: Cucurella burned 32 real Serp keys then still failed encode.
    const forceFreshImages = shouldForceFreshEofSceneImages(
      { reuseSceneImages, forceFreshImages: opts.forceFreshImages === true },
      priorManifest,
    )
    if (forceFreshImages) {
      console.warn(
        `[eof-video] forcing fresh Serp fetch for job ${jobId} (clearing avoid history)`,
        opts.forceFreshImages === true ? 'reason=explicit_build' : 'reason=prior_placeholders',
      )
    }

    const scenesForVideo = await withDeadline(
      mapWithConcurrency(rows, IMAGE_CONCURRENCY, async (row) => {
        const imagePath = join(workDir, `scene-${row.index + 1}.jpg`)
        let imageMeta
        let resolvedImagePath = imagePath
        const prior = priorManifest.find((m) => m.index === row.index) || priorManifest[row.index]
        const priorHistory = Array.isArray(prior?.imageKeyHistory)
          ? prior.imageKeyHistory.filter(Boolean)
          : prior?.imageKey
            ? [prior.imageKey]
            : []
        // Placeholders / failed builds: do not carry avoidKeys — force a real Serp claim.
        const avoidKeys = forceFreshImages ? [] : priorHistory
        // A prior image render means this is a rebuild → rotate to a fresh candidate.
        const hadPriorImage =
          !forceFreshImages &&
          Boolean(prior && (prior.imageKey || prior.imageSource || prior.imageAttempt !== undefined))
        let imageKey = forceFreshImages ? null : prior?.imageKey || null
        let imageAttempt = forceFreshImages ? 0 : Number(prior?.imageAttempt) || 0
        let imageKeyHistory = forceFreshImages ? [] : priorHistory
        if (reuseSceneImages) {
          const restored = await ensureEofSceneImageOnDisk(jobId, row.index + 1)
          if (!restored || !existsSync(restored)) {
            throw new Error(
              `Scene ${row.index + 1} image is missing. Run Build Short once before regenerating voiceover only.`,
            )
          }
          assertEofCleanPlateImagePath(restored)
          resolvedImagePath = restored
          imageMeta = {
            source: prior?.imageSource || 'cache',
            imageQuery: row.imageQuery,
            imageTitle: prior?.imageTitle || null,
            imageUrl: prior?.imageUrl || null,
            sourcePage: prior?.sourcePage || null,
          }
        } else {
          const attempt = hadPriorImage ? imageAttempt + 1 : 0
          imageMeta = await fetchEofSceneImage({
            topic: job.topic,
            imageQuery: row.imageQuery,
            caption: row.caption,
            outPath: imagePath,
            index: row.index,
            refresh: true,
            attempt,
            avoidKeys,
            wikiPool,
            oxyPool,
            plainTextDraft: String(job.script?.plainTextDraft || '').trim(),
            intent: oxyPool?.intent || null,
            // After a Serp job pool, skip AP/CSE/Pexels hangs — fail fast to placeholder/error.
            skipSlowFallbacks: Boolean(oxyPool),
          })
          imageAttempt = attempt
          imageKey = imageMeta.imageKey || null
          // Track real (non-placeholder) keys so repeated rebuilds keep trying new photos.
          if (
            imageKey &&
            imageMeta.source !== 'placeholder' &&
            imageMeta.source !== 'placeholder-no-image-keys'
          ) {
            imageKeyHistory = appendEofImageKeyHistory(avoidKeys, imageKey)
          }
        }
        imagesDone += 1
        await report(reuseSceneImages ? 'video' : 'images', imagesDone)
        return {
          index: row.index,
          durationSec: row.durationSec,
          caption: row.caption,
          narration: row.narration,
          imagePath: resolvedImagePath,
          imageSource: imageMeta.source,
          imageQueryUsed: imageMeta.imageQuery || row.imageQuery,
          imageKey,
          imageAttempt,
          imageKeyHistory,
          imageTitle: imageMeta.imageTitle || imageMeta.pinTitle || prior?.imageTitle || null,
          imageUrl: imageMeta.imageUrl || prior?.imageUrl || null,
          sourcePage: imageMeta.sourcePage || prior?.sourcePage || null,
          imageYear: imageMeta.imageYear || null,
        }
      }),
      SCENE_ASSIGN_DEADLINE_MS,
      'Scene image assign',
    )

    const placeholderCount = scenesForVideo.filter((s) =>
      String(s.imageSource || '').startsWith('placeholder'),
    ).length
    if (placeholderCount > 0) {
      console.warn(
        `[eof-video] ${placeholderCount}/${scenesForVideo.length} scenes used placeholders for job ${jobId}`,
        scenesForVideo.map((s) => `${s.index}:${s.imageSource}:${s.imageTitle || ''}`).join(' | '),
      )
    }
    if (placeholderCount === scenesForVideo.length && scenesForVideo.length > 0) {
      throw new Error(
        formatEofNoSceneImagesError({
          topic: job.topic,
          providerOrder: imageFetchDiag.providerOrder,
          providerAttempts: imageFetchDiag.providerAttempts,
          scrapeHitsBeforeFilter: imageFetchDiag.scrapeHitsBeforeFilter,
          scrapeHitsAfterFilter: imageFetchDiag.scrapeHitsAfterFilter,
          wikiHits: imageFetchDiag.wikiHits,
          genHits: imageFetchDiag.genHits,
          subject: imageFetchDiag.subject,
        }),
      )
    }

    scenesForVideo.sort((a, b) => a.index - b.index)
    // 5-scene Shorts land at 42% here ("Building scene clip 1 of 5…") — heartbeat so UI isn't frozen.
    let videoProgressIndex = 0
    await report('video', 0, {
      force: true,
      message: `Building scene clip 1 of ${sceneCount} (ffmpeg)…`,
    })
    const stopVideoHb = startProgressHeartbeat(async () => {
      const n = Math.min(videoProgressIndex + 1, sceneCount)
      await report('video', videoProgressIndex, {
        force: true,
        message: `Encoding scene clip ${n} of ${sceneCount} (ffmpeg)…`,
      })
    }, 4000)

    const draftBlob = String(job.script?.plainTextDraft || '').trim()
    const secondaryPeople = listSecondaryImageSubjects(job.topic, draftBlob)
    const sceneCountForOverlay = scenesForVideo.length
    const secondarySceneIndex =
      secondaryPeople.length && sceneCountForOverlay >= 3
        ? Math.min(1, Math.max(0, sceneCountForOverlay - 2))
        : null

    let relPath
    let rendered
    try {
      // Stills gate — stop before ffmpeg when placeholders / clickbait pop sources fail hard.
      // Skipped on remux paths that reuse scene images (Remove song / remix / captions / effects).
      if (!skipStillsPreflight) {
        const stillsManifest = scenesForVideo.map((s) => ({
          index: s.index,
          durationSec: s.durationSec,
          caption: s.caption,
          imageSource: s.imageSource || null,
          imageKey: s.imageKey || null,
          imageTitle: s.imageTitle || null,
          imageUrl: s.imageUrl || null,
          sourcePage: s.sourcePage || null,
          imageQuery: s.imageQueryUsed || s.imageQuery || null,
          imageQueryUsed: s.imageQueryUsed || null,
        }))
        await applyEofShortQualityStillsPreflightToJob(jobId, {
          mode: qualityGateMode,
          blockOnFail: true,
          jobSnapshot: { narrationManifest: stillsManifest },
          renderMeta: {
            hasSecondarySubject: secondaryPeople.length > 0,
            secondarySceneIndex,
          },
        })
      }

      rendered = await withDeadline(
        renderEofProductionVideo({
          jobId,
          scenes: scenesForVideo,
          mixedAudioPath: mixedPath,
          captionStyle: job.captionStyle,
          captionLayout: job.captionLayout || job.script?.captionLayout || null,
          zapcapTemplateId: job.zapcapTemplateId,
          forceSlim: slimBuild,
          ...eofServerlessSlimRenderOpts(
            {
              transitionStyle: job.transitionStyle,
              colorGrade: job.colorGrade,
              enhanceStyle: job.enhanceStyle,
              overlayMoments: resolveEofOverlayMoments(job.overlayMoments),
            },
            slimBuild,
          ),
          format: job.script?.format,
          captionMode,
          videoEffects: job.videoEffects,
          stickers: job.stickers,
          hasSecondarySubject: secondaryPeople.length > 0,
          secondarySceneIndex,
          onSceneProgress: async (done) => {
            videoProgressIndex = done
            await report('video', done)
          },
        }),
        VIDEO_ENCODE_DEADLINE_MS,
        'Video encode (ffmpeg)',
      )
      relPath = rendered.relPath
    } finally {
      stopVideoHb()
    }

    await report('mux', sceneCount, { force: true })
    await updateEofProductionRenderProgress(jobId, null)

    const updatedManifest = rows.map((entry, i) => {
      const videoScene = scenesForVideo.find((s) => s.index === entry.index) || scenesForVideo[i]
      return {
        index: entry.index,
        durationSec: videoScene?.durationSec ?? entry.durationSec,
        caption: videoScene?.caption ?? entry.caption,
        imageQuery: entry.imageQuery,
        imageSource: videoScene?.imageSource || null,
        imageQueryUsed: videoScene?.imageQueryUsed || entry.imageQuery,
        imageKey: videoScene?.imageKey ?? null,
        imageAttempt: videoScene?.imageAttempt ?? 0,
        imageKeyHistory: Array.isArray(videoScene?.imageKeyHistory) ? videoScene.imageKeyHistory : [],
        imageTitle: videoScene?.imageTitle || null,
        imageUrl: videoScene?.imageUrl || null,
        sourcePage: videoScene?.sourcePage || null,
        imageYear: videoScene?.imageYear || null,
      }
    })

    // Keep script durations in sync with what we rendered
    const nextScript = {
      ...job.script,
      scenes: scriptScenes.map((s, i) => ({
        ...s,
        durationSec: updatedManifest[i]?.durationSec ?? s.durationSec,
        caption: updatedManifest[i]?.caption ?? s.caption,
        narration: updatedManifest[i]?.caption ?? s.narration,
      })),
    }

    const videoAbs = eofProductionVideoAbsPath(jobId)
    await saveEofSceneImagesArtifact(jobId, workDir)
    const persisted = assertEofVideoPersisted(await persistEofVideoArtifact(jobId, videoAbs))
    if (persisted.recompressed) {
      console.info(
        `[eof-production] stored compressed Short for job ${jobId} (${persisted.bytes} bytes)`,
      )
    }

    // Only mark video_rendered after durable base64 is stored (assert above throws otherwise).
    const saved = await updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED,
      renderOutputPath: relPath,
      narrationManifest: updatedManifest,
      script: nextScript,
      captionEngine: rendered.captionEngine || null,
      // Keep the chosen template when ZapCap ran; clear for live/off
      zapcapTemplateId:
        rendered.zapcapTemplateId !== undefined
          ? rendered.zapcapTemplateId
          : job.zapcapTemplateId || null,
      errorMessage: null,
      qualityGate: null,
    })

    // Heuristic (+ optional vision) QA — report always; auto-publish blocks separately.
    try {
      const { job: gated } = await applyEofShortQualityGateToJob(jobId, {
        mode: 'manual',
        renderMeta: {
          overlayCount: rendered.videoLook?.overlayCount ?? rendered.overlayMoments?.length ?? 0,
          overlayMoments: rendered.overlayMoments || [],
          hasSecondarySubject: secondaryPeople.length > 0,
          secondarySceneIndex,
          captionEngine: rendered.captionEngine || null,
        },
      })
      return gated || saved
    } catch (qe) {
      console.warn(
        '[eof-video] quality gate skipped',
        jobId,
        qe instanceof Error ? qe.message : qe,
      )
      return saved
    }
  } catch (e) {
    if (e instanceof EofQualityGateBlockedError) throw e
    await markEofProductionJobFailed(jobId, e instanceof Error ? e.message : 'Video render failed')
    throw e
  }
}
