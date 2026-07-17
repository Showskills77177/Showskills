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
import { isEofOxylabsConfigured, fetchEofOxylabsJobPool } from './eofOxylabsImages.mjs'
import { isEofSerpApiConfigured, fetchEofSerpApiJobPool } from './eofSerpApiImages.mjs'
import {
  getEofImageProviderSettings,
  normalizeEofImageProvider,
  resolveEofImageProviderAttemptOrder,
} from './eofImageProviderSettings.mjs'
import { renderEofProductionVideo, eofProductionVideoRelPath, eofProductionVideoAbsPath } from './eofProductionVideo.mjs'
import { mapWithConcurrency, createThrottledWriter } from './eofAsyncPool.mjs'
import {
  ensureEofMixedAudioOnDisk,
  persistEofVideoArtifact,
  saveEofSceneImagesArtifact,
  ensureEofSceneImageOnDisk,
  clearEofVideoArtifact,
  clearEofVideoOnlyArtifact,
} from './eofProductionArtifacts.mjs'

const IMAGE_CONCURRENCY = Number(process.env.EOF_IMAGE_CONCURRENCY) || 3
/** Per-scene history length — keep ≥20 rebuilds of avoidKeys before oldest URLs can repeat. */
export const EOF_IMAGE_KEY_HISTORY_LIMIT = 32

/** Append a used image key; newest last, capped for durable narrationManifest size. */
export function appendEofImageKeyHistory(priorHistory, imageKey, limit = EOF_IMAGE_KEY_HISTORY_LIMIT) {
  const prior = Array.isArray(priorHistory) ? priorHistory.filter(Boolean) : []
  const key = String(imageKey || '').trim()
  if (!key) return prior.slice(-Math.max(1, limit))
  return [...prior.filter((k) => k !== key), key].slice(-Math.max(1, Number(limit) || EOF_IMAGE_KEY_HISTORY_LIMIT))
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
 * }} [opts]
 */
export async function renderEofProductionVideoJob(jobId, opts = {}) {
  const includeAudioIfPresent = opts.includeAudioIfPresent === true
  const reuseSceneImages = opts.reuseSceneImages === true
  const captionMode =
    opts.captionMode === 'zapcap-only' ? 'zapcap-only' : opts.captionMode === 'auto' ? 'auto' : 'free'
  const imageProviderOverride =
    opts.imageProvider !== undefined && opts.imageProvider !== null && String(opts.imageProvider).trim()
      ? normalizeEofImageProvider(opts.imageProvider)
      : null
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const scriptScenes = job.script?.scenes || []
  if (!scriptScenes.length) {
    throw new Error('Job has no script scenes — write a script first.')
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
  })

  const throttledProgress = createThrottledWriter(
    (progress) => updateEofProductionRenderProgress(jobId, progress),
    700,
  )

  async function report(stage, sceneIndex = 0, { force = false } = {}) {
    await throttledProgress(
      buildEofRenderProgress({
        stage,
        sceneIndex,
        sceneCount,
        startedAt: renderStartedAt,
        estimatedTotalSec,
        pipeline: 'video',
      }),
      { force },
    )
  }

  try {
    // Drop prior durable MP4 (and stills when refreshing) so a failed rebuild cannot leave
    // status=video_rendered with an empty/stale video_base64 from a half-written path.
    if (reuseSceneImages) {
      await clearEofVideoOnlyArtifact(jobId).catch(() => {})
    } else {
      await clearEofVideoArtifact(jobId).catch(() => {})
      clearEofSceneImageCache(workDir)
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
    // Order follows admin imageProvider (auto / serpapi / oxylabs), then AP/CSE per scene.
    let oxyPool = null
    let wikiPool = []
    if (!reuseSceneImages) {
      const maxAttempt = Math.max(
        0,
        ...priorManifest.map((m) => Number(m?.imageAttempt) || 0),
      )
      const imageSettings = await getEofImageProviderSettings().catch(() => ({
        imageProvider: 'auto',
      }))
      // Per-rebuild override (Production UI) wins over the saved admin default.
      const preferredProvider = imageProviderOverride || imageSettings.imageProvider || 'auto'
      const providerOrder = resolveEofImageProviderAttemptOrder(preferredProvider, {
        serpapi: isEofSerpApiConfigured(),
        oxylabs: isEofOxylabsConfigured(),
      })
      console.info(
        '[eof-video] image provider',
        preferredProvider,
        imageProviderOverride ? '(rebuild override)' : '(saved default)',
        '→',
        providerOrder.join(' → ') || '(none keyed)',
      )
      for (const provider of providerOrder) {
        if (oxyPool?.hits?.length) break
        if (provider === 'serpapi') {
          try {
            const pool = await fetchEofSerpApiJobPool({
              topic: job.topic,
              sceneCount: rows.length,
              attempt: maxAttempt,
            })
            if (pool.hits?.length) {
              oxyPool = {
                query: pool.query,
                hits: pool.hits,
                claimed: new Set(),
                source: 'serpapi',
              }
            }
          } catch (e) {
            console.warn('[eof-video] serpapi job pool failed', e instanceof Error ? e.message : e)
          }
          continue
        }
        if (provider === 'oxylabs') {
          try {
            const pool = await fetchEofOxylabsJobPool({
              topic: job.topic,
              sceneCount: rows.length,
              attempt: maxAttempt,
            })
            if (pool.hits?.length) {
              oxyPool = {
                query: pool.query,
                hits: pool.hits,
                claimed: new Set(),
                source: 'oxylabs',
              }
            }
          } catch (e) {
            console.warn('[eof-video] oxylabs job pool failed', e instanceof Error ? e.message : e)
          }
        }
      }
      if (!oxyPool?.hits?.length) {
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
      }
    }

    const scenesForVideo = await mapWithConcurrency(rows, IMAGE_CONCURRENCY, async (row) => {
      const imagePath = join(workDir, `scene-${row.index + 1}.jpg`)
      let imageMeta
      let resolvedImagePath = imagePath
      const prior = priorManifest.find((m) => m.index === row.index) || priorManifest[row.index]
      const priorHistory = Array.isArray(prior?.imageKeyHistory)
        ? prior.imageKeyHistory.filter(Boolean)
        : prior?.imageKey
          ? [prior.imageKey]
          : []
      // A prior image render means this is a rebuild → rotate to a fresh candidate.
      const hadPriorImage = Boolean(
        prior && (prior.imageKey || prior.imageSource || prior.imageAttempt !== undefined),
      )
      let imageKey = prior?.imageKey || null
      let imageAttempt = Number(prior?.imageAttempt) || 0
      let imageKeyHistory = priorHistory
      if (reuseSceneImages) {
        const restored = await ensureEofSceneImageOnDisk(jobId, row.index + 1)
        if (!restored || !existsSync(restored)) {
          throw new Error(
            `Scene ${row.index + 1} image is missing. Run Build Short once before regenerating voiceover only.`,
          )
        }
        resolvedImagePath = restored
        imageMeta = {
          source: 'cache',
          imageQuery: row.imageQuery,
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
          avoidKeys: priorHistory,
          wikiPool,
          oxyPool,
        })
        imageAttempt = attempt
        imageKey = imageMeta.imageKey || null
        // Track real (non-placeholder) keys so repeated rebuilds keep trying new photos.
        if (imageKey && imageMeta.source !== 'placeholder' && imageMeta.source !== 'placeholder-no-image-keys') {
          imageKeyHistory = appendEofImageKeyHistory(priorHistory, imageKey)
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
        imageTitle: imageMeta.imageTitle || imageMeta.pinTitle || null,
        imageYear: imageMeta.imageYear || null,
      }
    })

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
        `No real scene images could be downloaded for “${job.topic}”. Wikidata/Commons returned nothing usable — check server logs / network, then Rebuild video again.`,
      )
    }

    scenesForVideo.sort((a, b) => a.index - b.index)
    await report('video', 0, { force: true })

    const rendered = await renderEofProductionVideo({
      jobId,
      scenes: scenesForVideo,
      mixedAudioPath: mixedPath,
      captionStyle: job.captionStyle,
      zapcapTemplateId: job.zapcapTemplateId,
      transitionStyle: job.transitionStyle,
      colorGrade: job.colorGrade,
      enhanceStyle: job.enhanceStyle,
      format: job.script?.format,
      captionMode,
      onSceneProgress: async (done) => report('video', done),
    })
    const { relPath } = rendered

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
    return updateEofProductionJob(jobId, {
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
    })
  } catch (e) {
    await markEofProductionJobFailed(jobId, e instanceof Error ? e.message : 'Video render failed')
    throw e
  }
}
