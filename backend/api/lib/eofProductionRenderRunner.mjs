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
import {
  applyEofShortQualityPreflightToJob,
  EofQualityGateBlockedError,
} from './eofShortQualityGateApply.mjs'

function estimateFullBuildSec(script) {
  const scenes = script?.scenes?.length || 5
  return estimateEofRenderDurationSec(script) + estimateEofVideoRenderDurationSec(scenes)
}

/**
 * Full Short: narration (Edge TTS) + images + captions + mux.
 * @param {string} jobId
 * @param {{ imageProvider?: string | null, qualityGateMode?: 'auto'|'manual' }} [opts]
 */
export async function renderEofProductionFullBuild(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'

  try {
    // Plan-time gate — stop before TTS / image credits / ffmpeg on hard fails.
    await applyEofShortQualityPreflightToJob(jobId, {
      mode: qualityGateMode,
      blockOnFail: true,
    })
    await renderEofProductionAudio(jobId)
    return await renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      captionMode: 'free',
      imageProvider: opts.imageProvider,
      qualityGateMode,
      skipPlanPreflight: true,
    })
  } catch (e) {
    if (e instanceof EofQualityGateBlockedError) throw e
    const message = e instanceof Error ? e.message : 'Build failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/**
 * @param {string} jobId
 * @param {{ imageProvider?: string | null, qualityGateMode?: 'auto'|'manual' }} [opts]
 */
export async function startEofProductionFullBuildBackground(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'
  // Fail fast in the request path so admin sees the report without a "Building…" flash.
  await applyEofShortQualityPreflightToJob(jobId, {
    mode: qualityGateMode,
    blockOnFail: true,
  })

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
    renderEofProductionFullBuild(jobId, { ...opts, qualityGateMode }).catch((e) => {
      if (e instanceof EofQualityGateBlockedError) return
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
      // Keep intentional VO-only after Remove song (do not re-auto-pick a bed).
      allowNoMusic: true,
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
      captionMode: 'free',
      skipPlanPreflight: true,
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

/**
 * Paid ZapCap pass only: re-stitch from cached scene stills + audio (no image refetch, no TTS),
 * then burn the selected ZapCap template. This is the ONLY render path that calls ZapCap.
 * @param {string} jobId
 */
export async function applyEofProductionZapcapCaptions(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  return renderEofProductionVideoJob(jobId, {
    includeAudioIfPresent: true,
    reuseSceneImages: true,
    captionMode: 'zapcap-only',
  })
}

/** @param {string} jobId */
export async function startApplyEofProductionZapcapBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()
  const estimatedTotalSec = estimateEofVideoRenderDurationSec(sceneCount) + 120

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'video',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec,
      pipeline: 'video',
      message: 'Applying ZapCap animated captions…',
    }),
  )

  const run = () =>
    applyEofProductionZapcapCaptions(jobId).catch((e) => {
      console.error('[eof-production] ZapCap apply failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for ZapCap apply', e)
    }
  }

  void run()
}

/**
 * Apply video effects only: remux Short from cached stills + VO with current effect filters.
 * Same spirit as Replace Captions — no image re-scrape / TTS.
 * @param {string} jobId
 */
export async function renderEofProductionEffectsApply(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const flags = await getEofArtifactFlags(jobId)
  if (!flags.hasDurableSceneImages) {
    throw new Error(
      'Scene stills are missing. Run Build Short once before applying effects (needs a clean plate).',
    )
  }

  console.info(
    '[eof-production] apply effects from clean stills (not short.mp4)',
    jobId,
    `scenes=${job.script.scenes.length}`,
  )

  try {
    return await renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      reuseSceneImages: true,
      captionMode: 'free',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Apply effects failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/**
 * Apply stickers/elements only: remux Short from cached stills + VO with current sticker overlays.
 * Same spirit as Replace Captions / Apply effects — no image re-scrape / TTS.
 * @param {string} jobId
 */
export async function renderEofProductionStickersApply(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const flags = await getEofArtifactFlags(jobId)
  if (!flags.hasDurableSceneImages) {
    throw new Error(
      'Scene stills are missing. Run Build Short once before applying stickers (needs a clean plate).',
    )
  }

  console.info(
    '[eof-production] apply stickers from clean stills (not short.mp4)',
    jobId,
    `scenes=${job.script.scenes.length}`,
  )

  try {
    return await renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      reuseSceneImages: true,
      captionMode: 'free',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Apply stickers failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/** @param {string} jobId */
export async function startEofProductionStickersApplyBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'video',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec: Math.max(40, sceneCount * 12),
      pipeline: 'video',
      message: 'Applying stickers (keeping images + voiceover)…',
    }),
  )

  const run = () =>
    renderEofProductionStickersApply(jobId).catch((e) => {
      console.error('[eof-production] apply stickers failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for apply stickers', e)
    }
  }

  void run()
}

/** @param {string} jobId */
export async function startEofProductionEffectsApplyBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'video',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec: Math.max(40, sceneCount * 12),
      pipeline: 'video',
      message: 'Applying effects (keeping images + voiceover)…',
    }),
  )

  const run = () =>
    renderEofProductionEffectsApply(jobId).catch((e) => {
      console.error('[eof-production] apply effects failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for apply effects', e)
    }
  }

  void run()
}

/**
 * Replace captions only: rebuild Short from clean scene stills + voiceover, then burn
 * the new free captions. Never remux from a previously captioned MP4 plate.
 * @param {string} jobId
 */
export async function renderEofProductionCaptionReplace(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const flags = await getEofArtifactFlags(jobId)
  // Stills are required — video alone is a captioned plate and must not be the source.
  if (!flags.hasDurableSceneImages) {
    throw new Error(
      'Scene stills are missing. Run Build Short once before replacing captions (needs a clean plate).',
    )
  }

  console.info(
    '[eof-production] caption replace from clean stills (not short.mp4)',
    jobId,
    `scenes=${job.script.scenes.length}`,
    `style=${job.captionStyle || 'default'}`,
  )

  try {
    return await renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      reuseSceneImages: true,
      captionMode: 'free',
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Caption replace failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/** @param {string} jobId */
export async function startEofProductionCaptionReplaceBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'video',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec: Math.max(40, sceneCount * 12),
      pipeline: 'video',
      message: 'Replacing captions (keeping images + voiceover)…',
    }),
  )

  const run = () =>
    renderEofProductionCaptionReplace(jobId).catch((e) => {
      console.error('[eof-production] caption replace failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for caption replace', e)
    }
  }

  void run()
}

/**
 * Post-build music bed remix: re-mix narration under a default/safe bed, remux Short
 * (reuse scene stills — no Oxylabs / TTS when scene MP3s are warm).
 * @param {string} jobId
 */
export async function renderEofProductionMusicRemix(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  try {
    await renderEofProductionAudio(jobId, {
      preserveSceneImages: true,
      reuseSceneAudio: true,
      // Respect cleared musicTrackId (Remove song) — do not re-auto-pick a default bed.
      allowNoMusic: true,
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
      captionMode: 'free',
      // Post-build audio-only remux — plan checks already passed on the original Build.
      skipPlanPreflight: true,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Music remix failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/** @param {string} jobId */
export async function startEofProductionMusicRemixBackground(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()
  const estimatedTotalSec = Math.max(45, Math.round(estimateEofVoiceoverRemuxDurationSec(job.script) * 0.7))

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING,
    errorMessage: null,
  })
  await updateEofProductionRenderProgress(
    jobId,
    buildEofRenderProgress({
      stage: 'mix',
      sceneIndex: 0,
      sceneCount,
      startedAt,
      estimatedTotalSec,
      pipeline: 'audio',
      message: 'Remixing music bed under voiceover…',
    }),
  )

  const run = () =>
    renderEofProductionMusicRemix(jobId).catch((e) => {
      console.error('[eof-production] music remix failed', jobId, e)
    })

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable for music remix', e)
    }
  }

  void run()
}

/**
 * @param {string} jobId
 * @param {{ imageProvider?: string | null, qualityGateMode?: 'auto'|'manual' }} [opts]
 */
export async function startEofProductionVideoRenderBackground(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')

  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'
  await applyEofShortQualityPreflightToJob(jobId, {
    mode: qualityGateMode,
    blockOnFail: true,
  })

  const sceneCount = job.script?.scenes?.length || 5
  const startedAt = new Date().toISOString()
  const estimatedTotalSec = estimateEofVideoRenderDurationSec(sceneCount)

  // Claim the job immediately so a second Rebuild click cannot share the same workDir/tmp.
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
      message: 'Refreshing images…',
    }),
  )

  const run = () =>
    renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      captionMode: 'free',
      imageProvider: opts.imageProvider,
      qualityGateMode,
      skipPlanPreflight: true,
    }).catch((e) => {
      if (e instanceof EofQualityGateBlockedError) return
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
