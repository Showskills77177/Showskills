import { renderEofProductionAudio } from './eofProductionRender.mjs'
import { renderEofProductionVideoJob } from './eofProductionRenderVideo.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  updateEofProductionRenderProgress,
  markEofProductionJobFailed,
} from './eofProductionJobs.mjs'
import {
  EOF_PRODUCTION_JOB_STATUS,
  buildEofRenderProgress,
  estimateEofVideoRenderDurationSec,
} from '../../../shared/eofProduction.mjs'

/**
 * Image Shorts only: fetch stills + assemble 9:16 MP4 with captions (no TTS/music).
 * @param {string} jobId
 */
export async function renderEofProductionFullBuild(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  try {
    return await renderEofProductionVideoJob(jobId, { includeAudioIfPresent: false })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Build failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/** @param {string} jobId */
export async function startEofProductionFullBuildBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()
  const estimatedTotalSec = estimateEofVideoRenderDurationSec(sceneCount)

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'images',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec,
      pipeline: 'video',
    }),
  )

  const run = () =>
    renderEofProductionFullBuild(jobId).catch((e) => {
      console.error('[eof-production] image Short build failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for full build', e)
    }
  }

  void run()
}

/**
 * Legacy audio path (kept for manual "audio only" if ever re-enabled).
 * @param {string} jobId
 */
export async function startEofProductionRenderBackground(jobId) {
  const run = () =>
    renderEofProductionAudio(jobId).catch((e) => {
      console.error('[eof-production] background render failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable, falling back to inline render', e)
    }
  }

  void run()
}

/** @param {string} jobId */
export async function startEofProductionVideoRenderBackground(jobId) {
  const run = () =>
    renderEofProductionVideoJob(jobId, { includeAudioIfPresent: false }).catch((e) => {
      console.error('[eof-production] background video render failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for video', e)
    }
  }

  void run()
}
