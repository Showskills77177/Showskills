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
import { renderEofProductionVideo, eofProductionVideoRelPath, eofProductionVideoAbsPath } from './eofProductionVideo.mjs'
import { mapWithConcurrency, createThrottledWriter } from './eofAsyncPool.mjs'
import {
  ensureEofMixedAudioOnDisk,
  persistEofVideoArtifact,
  saveEofSceneImagesArtifact,
  ensureEofSceneImageOnDisk,
} from './eofProductionArtifacts.mjs'

const IMAGE_CONCURRENCY = Number(process.env.EOF_IMAGE_CONCURRENCY) || 3

/**
 * Build 9:16 Short MP4 from script scenes: stock images + on-screen captions.
 * Audio is optional (legacy path). Image-only Shorts are the default.
 * @param {string} jobId
 * @param {{ includeAudioIfPresent?: boolean, reuseSceneImages?: boolean, captionMode?: 'auto' | 'free' | 'zapcap-only' }} [opts]
 */
export async function renderEofProductionVideoJob(jobId, opts = {}) {
  const includeAudioIfPresent = opts.includeAudioIfPresent === true
  const reuseSceneImages = opts.reuseSceneImages === true
  const captionMode =
    opts.captionMode === 'zapcap-only' ? 'zapcap-only' : opts.captionMode === 'auto' ? 'auto' : 'free'
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
    await report(reuseSceneImages ? 'video' : 'images', 0, { force: true })
    if (!reuseSceneImages) {
      clearEofSceneImageCache(workDir)
    }

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
    // One Wikidata/Commons resolve for the whole job — avoids 5× parallel API storms on Vercel.
    let wikiPool = []
    if (!reuseSceneImages) {
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
      if (!wikiPool.length) {
        console.warn('[eof-video] no Wikidata/Commons pool for', job.topic, '— falling back per-scene')
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
          outPath: imagePath,
          index: row.index,
          refresh: true,
          attempt,
          avoidKeys: priorHistory,
          wikiPool,
        })
        imageAttempt = attempt
        imageKey = imageMeta.imageKey || null
        // Track real (non-placeholder) keys so repeated rebuilds keep trying new photos.
        if (imageKey && imageMeta.source !== 'placeholder' && imageMeta.source !== 'placeholder-no-image-keys') {
          imageKeyHistory = [...priorHistory.filter((k) => k !== imageKey), imageKey].slice(-8)
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
    const persisted = await persistEofVideoArtifact(jobId, videoAbs)
    if (!persisted.saved) {
      const mb = (persisted.bytes / (1024 * 1024)).toFixed(1)
      throw new Error(
        `Short rendered but could not be stored for preview (${mb}MB after compression). Rebuild video, or shorten the voiceover.`,
      )
    }
    if (persisted.recompressed) {
      console.info(
        `[eof-production] stored compressed Short for job ${jobId} (${persisted.bytes} bytes)`,
      )
    }

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
