/**
 * Image Shorts with voiceover: TTS + music mix → stills + captions → muxed 9:16 MP4.
 */
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
  estimateEofVoiceoverRemuxDurationSec,
} from '../../../shared/eofProduction.mjs'
import { getEofArtifactFlags } from './eofProductionArtifacts.mjs'

function estimateFullBuildSec(script) {
  const scenes = script?.scenes?.length || 5
  return estimateEofRenderDurationSec(script) + estimateEofVideoRenderDurationSec(scenes)
}

/**
 * Full Short: narration (Edge TTS) + images + captions + mux.
 * @param {string} jobId
 */
export async function renderEofProductionFullBuild(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  try {
    await renderEofProductionAudio(jobId)
    return await renderEofProductionVideoJob(jobId, { includeAudioIfPresent: true })
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
  const estimatedTotalSec = estimateFullBuildSec(job.script)

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
    renderEofProductionFullBuild(jobId).catch((e) => {
      console.error('[eof-production] full Short build failed', jobId, e)
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
 * Legacy audio-only path.
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

/**
 * Re-synthesize narration with current voice settings, then remux the Short using cached scene stills.
 * Skips stock-image fetch — the cheap path after tuning Brian sliders.
 * @param {string} jobId
 */
export async function renderEofProductionVoiceoverOnly(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  try {
    await renderEofProductionAudio(jobId, {
      preserveSceneImages: true,
      voiceRegenerationMode: true,
    })

    const refreshed = await getEofProductionJob(jobId)
    const flags = await getEofArtifactFlags(jobId)
    const canRemux =
      flags.hasDurableSceneImages ||
      flags.hasDurableVideo ||
      refreshed?.status === EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED ||
      Boolean(refreshed?.renderOutputPath)

    if (!canRemux) {
      return refreshed
    }

    return await renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      reuseSceneImages: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Voiceover regeneration failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/** @param {string} jobId */
export async function startEofProductionVoiceoverRegenerationBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()
  const estimatedTotalSec = estimateEofVoiceoverRemuxDurationSec(job.script)

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
      message: 'Regenerating voiceover with your Brian settings…',
    }),
  )

  const run = () =>
    renderEofProductionVoiceoverOnly(jobId).catch((e) => {
      console.error('[eof-production] voiceover regeneration failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for voiceover regen', e)
    }
  }

  void run()
}

/** @param {string} jobId */
export async function startEofProductionVideoRenderBackground(jobId) {
  const run = () =>
    renderEofProductionVideoJob(jobId, { includeAudioIfPresent: true }).catch((e) => {
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
