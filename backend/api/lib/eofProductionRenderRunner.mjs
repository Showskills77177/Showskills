/**
 * Image Shorts with voiceover: TTS + music mix → stills + captions → muxed 9:16 MP4.
 */
import { renderEofProductionAudio } from './eofProductionRender.mjs'
import {
  renderEofProductionVideoJob,
  eofRemuxVideoJobOpts,
} from './eofProductionRenderVideo.mjs'
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
import { getEofArtifactFlags } from './eofProductionArtifactFlags.mjs'
import {
  applyEofShortQualityPreflightToJob,
  EofQualityGateBlockedError,
} from './eofShortQualityGateApply.mjs'
import {
  capEofScriptScenesForServerless,
  isEofVercelRuntime,
  scheduleEofBuildContinue,
} from './eofProductionServerless.mjs'
import {
  isEofExternalWorkerConfigured,
  scheduleEofVideoOnWorker,
} from './eofProductionWorkerDispatch.mjs'
import { isEofSlimBuildEnabled } from './eofBuildModeSettings.mjs'
import { hashEofTtsFingerprint } from '../../../shared/eofTtsReuse.mjs'

/**
 * Prefer Railway (or other) worker for video when configured; else Vercel continue-build.
 * @param {string} jobId
 * @param {{ imageProvider?: string|null, forceFreshImages?: boolean, qualityGateMode?: 'auto'|'manual' }} [opts]
 */
async function scheduleEofVideoHop(jobId, opts = {}) {
  if (isEofExternalWorkerConfigured()) {
    const scheduled = await scheduleEofVideoOnWorker(jobId, opts)
    if (scheduled?.ok) return scheduled
    console.warn(
      '[eof-production] external worker hop failed — falling back to Vercel continue-build',
      jobId,
      scheduled?.reason || scheduled?.status || 'unknown',
    )
  }
  return scheduleEofBuildContinue(jobId, 'video', {
    imageProvider: opts.imageProvider,
    forceFreshImages: opts.forceFreshImages === true,
  })
}

/**
 * Start background work and return immediately (202).
 * On Vercel Pro: waitUntil keeps the full Short alive after the response (maxDuration 300).
 * Locally: fire-and-forget. Never await the whole encode in the HTTP request
 * (browser/proxy aborts would kill Serp→ffmpeg mid-flight).
 * @param {() => Promise<unknown>} run
 */
async function runEofProductionWork(run) {
  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(run())
      return
    } catch (e) {
      console.warn('[eof-production] waitUntil unavailable', e instanceof Error ? e.message : e)
    }
  }
  void run()
}

/**
 * Cap scenes when Hobby slim is on (UI setting or EOF_FORCE_SLIM).
 * @param {string} jobId
 */
async function maybeCapScenesForServerlessBuild(jobId) {
  if (!(await isEofSlimBuildEnabled())) return
  const job = await getEofProductionJob(jobId)
  if (!job?.script?.scenes?.length) return
  const capped = capEofScriptScenesForServerless(job.script)
  if (!capped.trimmed) return
  console.warn(
    `[eof-production] capping scenes ${capped.before}→${capped.after} for slim/Hobby build`,
    jobId,
  )
  await updateEofProductionJob(jobId, { script: capped.script })
}

function estimateFullBuildSec(script) {
  const scenes = script?.scenes?.length || 5
  return estimateEofRenderDurationSec(script) + estimateEofVideoRenderDurationSec(scenes)
}

/**
 * Full Short end-to-end: narration + images + captions + mux (Pro default path).
 * @param {string} jobId
 * @param {{ imageProvider?: string | null, qualityGateMode?: 'auto'|'manual', skipPlanPreflight?: boolean, forceFreshImages?: boolean }} [opts]
 */
export async function renderEofProductionFullBuild(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'

  try {
    await maybeCapScenesForServerlessBuild(jobId)
    // Plan-time gate — stop before TTS / image credits / ffmpeg on hard fails.
    if (!opts.skipPlanPreflight) {
      await applyEofShortQualityPreflightToJob(jobId, {
        mode: qualityGateMode,
        blockOnFail: true,
      })
    }
    await renderEofProductionAudio(jobId)
    return await renderEofProductionVideoJob(jobId, {
      includeAudioIfPresent: true,
      captionMode: 'free',
      imageProvider: opts.imageProvider,
      qualityGateMode,
      skipPlanPreflight: true,
      forceFreshImages: opts.forceFreshImages === true,
    })
  } catch (e) {
    if (e instanceof EofQualityGateBlockedError) throw e
    const message = e instanceof Error ? e.message : 'Build failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/**
 * One Hobby/slim step of a Short build (TTS **or** Serp+encode).
 * When Hobby slim is on, schedules the next step via continue-build self-fetch.
 * Without slim, runs the remaining work in the same invocation.
 * @param {string} jobId
 * @param {{ step?: 'audio'|'video'|'auto', imageProvider?: string|null, qualityGateMode?: 'auto'|'manual', forceFreshImages?: boolean }} [opts]
 */
export async function continueEofProductionBuild(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const status = String(job.status || '')
  if (
    status === EOF_PRODUCTION_JOB_STATUS.VIDEO_RENDERED ||
    status === EOF_PRODUCTION_JOB_STATUS.FAILED
  ) {
    return job
  }
  // After audio, status is `rendered` — allow video step to proceed (do not early-return).
  if (
    status !== EOF_PRODUCTION_JOB_STATUS.RENDERING &&
    status !== EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO &&
    status !== EOF_PRODUCTION_JOB_STATUS.RENDERED
  ) {
    return job
  }

  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'
  const flags = await getEofArtifactFlags(jobId)
  const stage = String(job.renderProgress?.stage || 'tts')
  let step = opts.step === 'audio' || opts.step === 'video' ? opts.step : 'auto'

  // Audio is done when durable mix exists OR job already has mixedAudioPath / RENDERED
  // after TTS (durable save may have failed — do NOT re-burn ElevenLabs). But a stored
  // mix only counts as "done" if it matches the CURRENT voice/narration fingerprint —
  // otherwise a voice-preset switch (e.g. British → Brian) silently reuses the old
  // audio because durable audio already existed from a prior render.
  const currentFingerprint = hashEofTtsFingerprint({
    script: job.script,
    voicePreset: job.voicePreset,
    voiceSettings: job.voiceSettings,
  })
  const durableAudioMatchesVoice = job.ttsAudioHash === currentFingerprint
  const audioAlreadyDone =
    (flags.hasDurableAudio && durableAudioMatchesVoice) ||
    (Boolean(job.mixedAudioPath) && durableAudioMatchesVoice) ||
    (Array.isArray(job.narrationManifest) &&
      job.narrationManifest.length > 0 &&
      durableAudioMatchesVoice) ||
    (status === EOF_PRODUCTION_JOB_STATUS.RENDERED && durableAudioMatchesVoice)

  if (step === 'auto') {
    step = audioAlreadyDone ? 'video' : 'audio'
  }

  try {
    await maybeCapScenesForServerlessBuild(jobId)

    if (step === 'audio') {
      if (!audioAlreadyDone) {
        console.info('[eof-production] continue step=audio', jobId)
        await updateEofProductionJob(jobId, {
          status: EOF_PRODUCTION_JOB_STATUS.RENDERING,
          errorMessage: null,
        })
        await renderEofProductionAudio(jobId)
      } else {
        console.info('[eof-production] continue audio already done → video', jobId)
      }
      // Prefer Railway worker when configured. Else Vercel continue-build hop
      // (one isolate cannot fit TTS + Serp + 4-scene encode under maxDuration 300).
      // If neither hop starts, fall through and finish video in this waitUntil.
      if (
        isEofExternalWorkerConfigured() ||
        (await isEofSlimBuildEnabled()) ||
        isEofVercelRuntime()
      ) {
        // Claim the job before the hop: while it sat on `rendered` a second Build Short
        // passed the API guard and ran a parallel encode over the same work dir.
        await updateEofProductionJob(jobId, {
          status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
          errorMessage: null,
        })
        const scheduled = await scheduleEofVideoHop(jobId, {
          imageProvider: opts.imageProvider,
          forceFreshImages: opts.forceFreshImages === true,
          qualityGateMode,
        })
        if (scheduled?.ok) {
          return getEofProductionJob(jobId)
        }
        console.warn('[eof-production] continue hop not scheduled — keeping build in this isolate', jobId)
        console.warn(
          '[eof-production] video hop schedule failed — running video in-process',
          jobId,
          scheduled?.reason || scheduled?.status || 'unknown',
        )
      }
      step = 'video'
    }

    if (step === 'video') {
      console.info('[eof-production] continue step=video', jobId, `stage=${stage}`)
      await updateEofProductionJob(jobId, {
        status: EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO,
        errorMessage: null,
      })
      const reuse =
        flags.hasDurableSceneImages &&
        (stage === 'video' || stage === 'mux') &&
        !opts.forceFreshImages
      return await renderEofProductionVideoJob(jobId, {
        includeAudioIfPresent: true,
        captionMode: 'free',
        imageProvider: opts.imageProvider,
        qualityGateMode,
        skipPlanPreflight: true,
        reuseSceneImages: reuse,
        forceFreshImages: opts.forceFreshImages === true,
      })
    }

    return getEofProductionJob(jobId)
  } catch (e) {
    if (e instanceof EofQualityGateBlockedError) throw e
    const message = e instanceof Error ? e.message : 'Build failed'
    await markEofProductionJobFailed(jobId, message)
    throw e
  }
}

/**
 * Hobby/slim continue-build entry — returns immediately; work runs under waitUntil.
 * Never await Serp+ffmpeg in the HTTP request (that blocked the prior audio invocation's fetch).
 * @param {string} jobId
 * @param {{ step?: 'audio'|'video'|'auto', imageProvider?: string|null, qualityGateMode?: 'auto'|'manual', forceFreshImages?: boolean }} [opts]
 */
export async function startEofProductionContinueBackground(jobId, opts = {}) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  const status = String(job.status || '')
  const step = opts.step === 'audio' || opts.step === 'video' ? opts.step : 'auto'
  // After TTS, status is `rendered` — still allow the video continue hop.
  const okStatus =
    status === EOF_PRODUCTION_JOB_STATUS.RENDERING ||
    status === EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO ||
    (step === 'video' && status === EOF_PRODUCTION_JOB_STATUS.RENDERED) ||
    (step === 'auto' && status === EOF_PRODUCTION_JOB_STATUS.RENDERED)
  if (!okStatus) {
    return job
  }

  const qualityGateMode = opts.qualityGateMode === 'auto' ? 'auto' : 'manual'
  const run = () =>
    continueEofProductionBuild(jobId, {
      step: opts.step,
      imageProvider: opts.imageProvider,
      qualityGateMode,
      forceFreshImages: opts.forceFreshImages === true,
    }).catch((e) => {
      if (e instanceof EofQualityGateBlockedError) return
      console.error('[eof-production] continue-build failed', jobId, e)
    })

  await runEofProductionWork(run)
  return getEofProductionJob(jobId)
}

/**
 * @param {string} jobId
 * @param {{ imageProvider?: string | null, qualityGateMode?: 'auto'|'manual', forceFreshImages?: boolean }} [opts]
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

  // Vercel: chunked continue-build (audio isolate → video isolate). Local Pro: one shot.
  const run = () =>
    (async () => {
      const slim = await isEofSlimBuildEnabled()
      if (slim || isEofVercelRuntime()) {
        return continueEofProductionBuild(jobId, {
          step: 'audio',
          imageProvider: opts.imageProvider,
          qualityGateMode,
          forceFreshImages: opts.forceFreshImages === true,
        })
      }
      return renderEofProductionFullBuild(jobId, {
        ...opts,
        qualityGateMode,
        skipPlanPreflight: true,
        forceFreshImages: opts.forceFreshImages === true,
      })
    })().catch(async (e) => {
      if (e instanceof EofQualityGateBlockedError) return
      console.error('[eof-production] full Short build failed', jobId, e)
      // Backstop: anything thrown outside the inner handlers would otherwise leave the job
      // stuck on rendering_* until the watchdog reports a vague "isolate stopped mid-build".
      await markEofProductionJobFailed(
        jobId,
        e instanceof Error ? e.message : 'Short build failed',
        { onlyWhenRendering: true },
      ).catch(() => {})
    })

  // Always return quickly → API 202; work continues via waitUntil (Pro) or continue-build (slim).
  await runEofProductionWork(run)
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

  await runEofProductionWork(run)
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

    return await renderEofProductionVideoJob(jobId, eofRemuxVideoJobOpts())
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

  await runEofProductionWork(run)
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

  return renderEofProductionVideoJob(jobId, eofRemuxVideoJobOpts({ captionMode: 'zapcap-only' }))
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

  await runEofProductionWork(run)
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
    return await renderEofProductionVideoJob(jobId, eofRemuxVideoJobOpts())
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
    return await renderEofProductionVideoJob(jobId, eofRemuxVideoJobOpts())
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
    (async () => {
      // Apply Stickers is remux-only but still real ffmpeg work — hand it to Railway
      // when configured so it doesn't hit Vercel's isolate limits, same as Build/Rebuild.
      if (isEofExternalWorkerConfigured()) {
        const scheduled = await scheduleEofVideoOnWorker(jobId, { mode: 'stickers-apply' })
        if (scheduled?.ok) return getEofProductionJob(jobId)
        console.warn(
          '[eof-production] worker hop failed on stickers apply — falling back in-process',
          jobId,
          scheduled?.reason || scheduled?.status || 'unknown',
        )
      }
      return renderEofProductionStickersApply(jobId)
    })().catch((e) => {
      console.error('[eof-production] apply stickers failed', jobId, e)
    })

  await runEofProductionWork(run)
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
    (async () => {
      // Apply Effects is remux-only but still real ffmpeg work — hand it to Railway
      // when configured so it doesn't hit Vercel's isolate limits, same as Build/Rebuild.
      if (isEofExternalWorkerConfigured()) {
        const scheduled = await scheduleEofVideoOnWorker(jobId, { mode: 'effects-apply' })
        if (scheduled?.ok) return getEofProductionJob(jobId)
        console.warn(
          '[eof-production] worker hop failed on effects apply — falling back in-process',
          jobId,
          scheduled?.reason || scheduled?.status || 'unknown',
        )
      }
      return renderEofProductionEffectsApply(jobId)
    })().catch((e) => {
      console.error('[eof-production] apply effects failed', jobId, e)
    })

  await runEofProductionWork(run)
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
    return await renderEofProductionVideoJob(jobId, eofRemuxVideoJobOpts())
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
    (async () => {
      // Replace Captions is remux-only but still real ffmpeg work — hand it to Railway
      // when configured so it doesn't hit Vercel's isolate limits, same as Build/Rebuild.
      // This was the actual cause of "ffmpeg failed: timed out after 30s" here — the
      // caption-replace path never hopped to the worker at all, unlike Build/Rebuild
      // Video, so it always ran on Vercel's constrained isolate.
      if (isEofExternalWorkerConfigured()) {
        const scheduled = await scheduleEofVideoOnWorker(jobId, { mode: 'caption-replace' })
        if (scheduled?.ok) return getEofProductionJob(jobId)
        console.warn(
          '[eof-production] worker hop failed on caption replace — falling back in-process',
          jobId,
          scheduled?.reason || scheduled?.status || 'unknown',
        )
      }
      return renderEofProductionCaptionReplace(jobId)
    })().catch((e) => {
      console.error('[eof-production] caption replace failed', jobId, e)
    })

  await runEofProductionWork(run)
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

    return await renderEofProductionVideoJob(jobId, eofRemuxVideoJobOpts())
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
    (async () => {
      // Music Remix re-mixes audio then remuxes video — both are cheap on Vercel's
      // memory budget individually, but the remux step is still real ffmpeg. Hand the
      // whole thing to Railway when configured, same as the other quick-edit actions.
      if (isEofExternalWorkerConfigured()) {
        const scheduled = await scheduleEofVideoOnWorker(jobId, { mode: 'music-remix' })
        if (scheduled?.ok) return getEofProductionJob(jobId)
        console.warn(
          '[eof-production] worker hop failed on music remix — falling back in-process',
          jobId,
          scheduled?.reason || scheduled?.status || 'unknown',
        )
      }
      return renderEofProductionMusicRemix(jobId)
    })().catch((e) => {
      console.error('[eof-production] music remix failed', jobId, e)
    })

  await runEofProductionWork(run)
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
    (async () => {
      await maybeCapScenesForServerlessBuild(jobId)
      // Rebuild Video: hand Serp+ffmpeg to Railway when configured (same as full Build).
      if (isEofExternalWorkerConfigured()) {
        const scheduled = await scheduleEofVideoOnWorker(jobId, {
          imageProvider: opts.imageProvider,
          forceFreshImages: true,
          qualityGateMode,
        })
        if (scheduled?.ok) return getEofProductionJob(jobId)
        console.warn(
          '[eof-production] worker hop failed on rebuild-video — falling back in-process',
          jobId,
          scheduled?.reason || scheduled?.status || 'unknown',
        )
      }
      if (await isEofSlimBuildEnabled()) {
        return continueEofProductionBuild(jobId, {
          step: 'video',
          imageProvider: opts.imageProvider,
          qualityGateMode,
          forceFreshImages: true,
        })
      }
      return renderEofProductionVideoJob(jobId, {
        includeAudioIfPresent: true,
        captionMode: 'free',
        imageProvider: opts.imageProvider,
        qualityGateMode,
        skipPlanPreflight: true,
        forceFreshImages: true,
      })
    })().catch((e) => {
      if (e instanceof EofQualityGateBlockedError) return
      console.error('[eof-production] background video render failed', jobId, e)
    })

  await runEofProductionWork(run)
}
