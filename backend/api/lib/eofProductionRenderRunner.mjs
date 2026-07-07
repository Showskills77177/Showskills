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
  estimateEofRenderDurationSec,
  estimateEofVideoRenderDurationSec,
} from '../../../shared/eofProduction.mjs'

/**
 * Narration + music, then images + Short MP4 — one server-side chain (Vercel waitUntil).
 * @param {string} jobId
 * @param {{ rebuild?: boolean }} [opts]
 */
export async function renderEofProductionFullBuild(jobId, { rebuild = false } = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const needsAudio =
    rebuild ||
    !job.mixedAudioPath ||
    ['draft', 'ready_script', 'failed'].includes(job.status)

  try {
    if (needsAudio) {
      await renderEofProductionAudio(jobId)
    }

    const afterAudio = await getEofProductionJob(jobId)
    if (!afterAudio) throw new Error('Production job not found after audio render.')
    if (afterAudio.status === 'failed') {
      throw new Error(afterAudio.errorMessage || 'Audio render failed')
    }
    if (!afterAudio.mixedAudioPath && afterAudio.status !== 'rendered') {
      throw new Error('Audio render did not produce mixed audio.')
    }

    return await renderEofProductionVideoJob(jobId)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Build failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/** @param {string} jobId @param {{ rebuild?: boolean }} [opts] */
export async function startEofProductionFullBuildBackground(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()
  const estimatedTotalSec =
    estimateEofRenderDurationSec(job.script) + estimateEofVideoRenderDurationSec(sceneCount)

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'tts',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec,
      pipeline: 'audio',
    }),
  )

  const run = () =>
    renderEofProductionFullBuild(jobId, opts).catch((e) => {
      console.error('[eof-production] full build failed', jobId, e)
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
 * Start audio render without blocking the HTTP response (Vercel waitUntil).
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
    renderEofProductionVideoJob(jobId).catch((e) => {
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
