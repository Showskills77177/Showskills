import { join } from 'node:path'
import { existsSync } from 'node:fs'
import {
  EOF_PRODUCTION_JOB_STATUS,
  buildEofRenderProgress,
  estimateEofRenderDurationSec,
} from '../../../shared/eofProduction.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  markEofProductionJobFailed,
  updateEofProductionRenderProgress,
} from './eofProductionJobs.mjs'
import { eofProductionWorkDir } from './eofSceneTts.mjs'
import { fetchEofSceneImage } from './eofSceneImages.mjs'
import { renderEofProductionVideo, eofProductionVideoRelPath } from './eofProductionVideo.mjs'
import { mapWithConcurrency, createThrottledWriter } from './eofAsyncPool.mjs'

const IMAGE_CONCURRENCY = Number(process.env.EOF_IMAGE_CONCURRENCY) || 3

/**
 * Build 9:16 Short MP4 from rendered audio + scene images/captions.
 * @param {string} jobId
 */
export async function renderEofProductionVideoJob(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const manifest = job.narrationManifest || []
  const scriptScenes = job.script?.scenes || []
  if (!manifest.length && !scriptScenes.length) {
    throw new Error('Job has no rendered scenes — run audio render first.')
  }

  const workDir = eofProductionWorkDir(jobId)
  const mixedPath = join(workDir, 'mixed.mp3')
  if (!existsSync(mixedPath)) {
    throw new Error('Mixed audio not found — render audio first.')
  }

  const sceneCount = Math.max(manifest.length, scriptScenes.length)
  const renderStartedAt = new Date().toISOString()
  const estimatedTotalSec = Math.max(20, Math.ceil(sceneCount * 4))

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
    await report('images', 0, { force: true })

    const rows = manifest.length
      ? manifest.map((m, i) => ({
          index: m.index ?? i,
          durationSec: m.durationSec,
          caption: m.caption ?? scriptScenes[i]?.caption,
          imageQuery: m.imageQuery ?? scriptScenes[i]?.imageQuery,
        }))
      : scriptScenes.map((s, i) => ({
          index: i,
          durationSec: s.durationSec || 4,
          caption: s.caption,
          imageQuery: s.imageQuery,
        }))

    let imagesDone = 0
    const scenesForVideo = await mapWithConcurrency(rows, IMAGE_CONCURRENCY, async (row) => {
      const imagePath = join(workDir, `scene-${row.index + 1}.jpg`)
      await fetchEofSceneImage({
        imageQuery: row.imageQuery,
        outPath: imagePath,
        index: row.index,
      })
      imagesDone += 1
      await report('images', imagesDone)
      return {
        index: row.index,
        durationSec: row.durationSec,
        caption: row.caption,
        imagePath,
      }
    })

    scenesForVideo.sort((a, b) => a.index - b.index)
    await report('video', 0, { force: true })

    const { relPath } = await renderEofProductionVideo({
      jobId,
      scenes: scenesForVideo,
      mixedAudioPath: mixedPath,
      onSceneProgress: async (done) => report('video', done),
    })

    await report('mux', sceneCount, { force: true })
    await updateEofProductionRenderProgress(jobId, null)

    return updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED,
      renderOutputPath: relPath,
      errorMessage: null,
    })
  } catch (e) {
    await markEofProductionJobFailed(jobId, e instanceof Error ? e.message : 'Video render failed')
    throw e
  }
}
