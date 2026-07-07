import { renderEofProductionAudio } from './eofProductionRender.mjs'
import { renderEofProductionVideoJob } from './eofProductionRenderVideo.mjs'
import { getEofProductionJob } from './eofProductionJobs.mjs'

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

  return renderEofProductionVideoJob(jobId)
}

/** @param {string} jobId @param {{ rebuild?: boolean }} [opts] */
export async function startEofProductionFullBuildBackground(jobId, opts = {}) {
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
