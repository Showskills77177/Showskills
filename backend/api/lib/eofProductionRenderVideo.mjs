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
import { renderEofProductionVideo, eofProductionVideoRelPath, eofProductionVideoAbsPath } from './eofProductionVideo.mjs'
import { mapWithConcurrency, createThrottledWriter } from './eofAsyncPool.mjs'
import { ensureEofMixedAudioOnDisk, saveEofVideoArtifact, saveEofSceneImagesArtifact, ensureEofSceneImageOnDisk } from './eofProductionArtifacts.mjs'

const IMAGE_CONCURRENCY = Number(process.env.EOF_IMAGE_CONCURRENCY) || 3

/**
 * Build 9:16 Short MP4 from script scenes: stock images + on-screen captions.
 * Audio is optional (legacy path). Image-only Shorts are the default.
 * @param {string} jobId
 * @param {{ includeAudioIfPresent?: boolean, reuseSceneImages?: boolean }} [opts]
 */
export async function renderEofProductionVideoJob(jobId, opts = {}) {
  const includeAudioIfPresent = opts.includeAudioIfPresent === true
  const reuseSceneImages = opts.reuseSceneImages === true
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
    const scenesForVideo = await mapWithConcurrency(rows, IMAGE_CONCURRENCY, async (row) => {
      const imagePath = join(workDir, `scene-${row.index + 1}.jpg`)
      let imageMeta
      let resolvedImagePath = imagePath
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
        imageMeta = await fetchEofSceneImage({
          topic: job.topic,
          imageQuery: row.imageQuery,
          outPath: imagePath,
          index: row.index,
          refresh: true,
        })
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
      }
    })

    scenesForVideo.sort((a, b) => a.index - b.index)
    await report('video', 0, { force: true })

    const rendered = await renderEofProductionVideo({
      jobId,
      scenes: scenesForVideo,
      mixedAudioPath: mixedPath,
      captionStyle: job.captionStyle,
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
    await saveEofVideoArtifact(jobId, videoAbs)

    return updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED,
      renderOutputPath: relPath,
      narrationManifest: updatedManifest,
      script: nextScript,
      captionEngine: rendered.captionEngine || null,
      zapcapTemplateId: rendered.zapcapTemplateId || null,
      errorMessage: null,
    })
  } catch (e) {
    await markEofProductionJobFailed(jobId, e instanceof Error ? e.message : 'Video render failed')
    throw e
  }
}
