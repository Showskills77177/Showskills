import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import {
  EOF_PRODUCTION_JOB_STATUS,
  EOF_VOICE_PRESETS,
  buildEofRenderProgress,
  estimateEofRenderDurationSec,
} from '../../../shared/eofProduction.mjs'
import {
  hashEofTtsFingerprint,
  hashEofSceneTtsLine,
  shouldReuseEofDurableMixedAudio,
  shouldReuseEofSceneAudioFile,
  planEofSceneTtsDedupe,
  eofTtsCreditGuardDecision,
  nextEofTtsSynthCount,
} from '../../../shared/eofTtsReuse.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  markEofProductionJobFailed,
  updateEofProductionRenderProgress,
  resetEofVoiceRegenerationBaseline,
  incrementEofVoiceRegenerationCount,
} from './eofProductionJobs.mjs'
import { pickEofMusicTrackForTopic, resolveEofMusicTrackFilePath } from './eofMusicTracks.mjs'
import {
  eofProductionWorkDir,
  eofProductionMixedAudioRelPath,
  synthesizeEofSceneNarration,
  probeAudioDurationSec,
} from './eofSceneTts.mjs'
import { mixEofNarrationWithMusic, isFfmpegAvailable } from './eofAudioMix.mjs'
import { hasBundledFfmpeg } from './eofFfmpeg.mjs'
import { mapWithConcurrency, createThrottledWriter, startProgressHeartbeat } from './eofAsyncPool.mjs'
import {
  saveEofMixedAudioArtifact,
  clearEofVideoArtifact,
  clearEofVideoOnlyArtifact,
  ensureEofMixedAudioOnDisk,
  getEofArtifactFlags,
} from './eofProductionArtifacts.mjs'
import { getElevenLabsMaxConcurrency } from './eofElevenLabsTts.mjs'

/** Edge can fan out; ElevenLabs free/starter is hard-capped at 2 concurrent. */
function resolveTtsConcurrency(voicePreset) {
  const preset = EOF_VOICE_PRESETS[voicePreset] || {}
  if (preset.engine === 'elevenlabs') return getElevenLabsMaxConcurrency()
  const n = Number(process.env.EOF_TTS_CONCURRENCY) || 3
  return Math.max(1, Math.min(4, Number.isFinite(n) ? Math.floor(n) : 3))
}

const MAX_INLINE_AUDIO_BYTES = 3_500_000

/** Process-wide lock so continue-build / waitUntil cannot double-run TTS for one job. */
const audioRenderLocks = new Set()

export async function readEofMixedAudioInline(jobId) {
  try {
    const mixedPath = (await ensureEofMixedAudioOnDisk(jobId)) || join(eofProductionWorkDir(jobId), 'mixed.mp3')
    const info = await stat(mixedPath)
    if (!info.isFile() || info.size > MAX_INLINE_AUDIO_BYTES) return null
    const buf = await readFile(mixedPath)
    return `data:audio/mpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

/**
 * Generate per-scene TTS and mix with catalog music bed.
 * @param {string} jobId
 * @param {{
 *   preserveSceneImages?: boolean,
 *   voiceRegenerationMode?: boolean,
 *   reuseSceneAudio?: boolean,
 *   allowNoMusic?: boolean,
 *   forceFreshAudio?: boolean,
 * }} [opts]
 * When `allowNoMusic` is true and the job has no `musicTrackId`, mix VO-only
 * (do not auto-pick a default bed). Used by post-build music remix / Remove song.
 */

/** True when remix/Remove-song must keep VO-only (never re-pick a default bed). */
export function shouldEofAllowNoMusic(opts = {}, job = {}) {
  return opts.allowNoMusic === true && !job?.musicTrackId
}

/**
 * A music remix must rebuild the mix from cached scene VO, never restore the
 * durable MP3 whose TTS hash matches but whose music choice may be stale.
 */
export function shouldEofReuseDurableMix(opts = {}, reuseState = {}) {
  if (opts.reuseSceneAudio === true || opts.allowNoMusic === true) return false
  return shouldReuseEofDurableMixedAudio(reuseState)
}

export async function renderEofProductionAudio(jobId, opts = {}) {
  const preserveSceneImages = opts.preserveSceneImages === true
  const voiceRegenerationMode = opts.voiceRegenerationMode === true
  const reuseSceneAudio = opts.reuseSceneAudio === true
  const forceFreshAudio = opts.forceFreshAudio === true
  const allowNoMusic = opts.allowNoMusic === true

  if (audioRenderLocks.has(jobId)) {
    console.info('eof:tts skip reuse', jobId, 'reason=in_flight_lock')
    return getEofProductionJob(jobId)
  }
  audioRenderLocks.add(jobId)

  try {
    const job = await getEofProductionJob(jobId)
    if (!job) throw new Error('Production job not found.')
    if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

    const ffmpegOk = (await hasBundledFfmpeg()) || (await isFfmpegAvailable())
    if (!ffmpegOk) {
      throw new Error(
        'ffmpeg is not available for audio render. Ensure ffmpeg-static is installed or set FFMPEG_PATH.',
      )
    }

    const fingerprint = hashEofTtsFingerprint({
      script: job.script,
      voicePreset: job.voicePreset,
      voiceSettings: job.voiceSettings,
    })
    const flags = await getEofArtifactFlags(jobId)
    const canReuseMixed = shouldEofReuseDurableMix(opts, {
      hasDurableAudio: flags.hasDurableAudio,
      storedFingerprint: job.ttsAudioHash,
      currentFingerprint: fingerprint,
      forceFreshAudio,
      voiceRegenerationMode,
    })

    if (canReuseMixed) {
      const restored = await ensureEofMixedAudioOnDisk(jobId)
      if (restored && existsSync(restored)) {
        console.info('eof:tts skip reuse', jobId, 'reason=durable_mixed', `hash=${fingerprint}`)
        await updateEofProductionJob(jobId, {
          status: EOF_PRODUCTION_JOB_STATUS.RENDERED,
          errorMessage: null,
          mixedAudioPath: eofProductionMixedAudioRelPath(jobId),
        })
        await updateEofProductionRenderProgress(jobId, null)
        return getEofProductionJob(jobId)
      }
    }

    const voicePresetMeta = EOF_VOICE_PRESETS[job.voicePreset] || {}
    const credit = eofTtsCreditGuardDecision({
      engine: voicePresetMeta.engine || 'edge',
      currentFingerprint: fingerprint,
      storedFingerprint: job.ttsAudioHash,
      synthCount: job.ttsSynthCount,
      voiceRegenerationMode,
    })
    if (credit.blocked) {
      throw new Error(credit.reason)
    }

    await updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.RENDERING,
      errorMessage: null,
    })

    const sceneCount = job.script.scenes.length
    const renderStartedAt = new Date().toISOString()
    const estimatedTotalSec = estimateEofRenderDurationSec(job.script)

    await updateEofProductionRenderProgress(
      jobId,
      buildEofRenderProgress({
        stage: 'tts',
        sceneIndex: 0,
        sceneCount,
        startedAt: renderStartedAt,
        estimatedTotalSec,
        pipeline: 'audio',
      }),
    )

    const throttledProgress = createThrottledWriter(
      (progress) => updateEofProductionRenderProgress(jobId, progress),
      700,
    )

    async function reportProgress(stage, sceneIndex = 0, { force = false } = {}) {
      const progress = buildEofRenderProgress({
        stage,
        sceneIndex,
        sceneCount,
        startedAt: renderStartedAt,
        estimatedTotalSec,
        pipeline: 'audio',
      })
      await throttledProgress(progress, { force })
      return progress
    }

    try {
      const workDir = eofProductionWorkDir(jobId)
      await reportProgress('tts', 0, { force: true })
      // Keep Pro quiet-stale accurate during long ElevenLabs / Edge TTS calls.
      const stopTtsHb = startProgressHeartbeat(async () => {
        await reportProgress('tts', 0, { force: true })
      }, 4000)

      const priorManifest = Array.isArray(job.narrationManifest) ? job.narrationManifest : []
      const scenePlans = job.script.scenes.map((scene, i) => {
        const text = String(scene.narration || '').trim()
        const lineHash = hashEofSceneTtsLine({
          text,
          voicePreset: job.voicePreset,
          voiceSettings: job.voiceSettings,
        })
        return { index: i, text, lineHash, scene }
      })

      const deduped = planEofSceneTtsDedupe(scenePlans)
      const outPaths = scenePlans.map((_, i) => join(workDir, `scene-${i + 1}.mp3`))
      const lineHashByIndex = new Map(scenePlans.map((s) => [s.index, s.lineHash]))
      const elevenLabsIds = new Map()
      let synthIncrements = 0
      const priorSynthCount =
        job.ttsAudioHash === fingerprint ? Number(job.ttsSynthCount) || 0 : 0

      try {
      // Reuse existing scene files with matching line hashes before any synthesize.
      for (const plan of scenePlans) {
        const outPath = outPaths[plan.index]
        const prior = priorManifest.find((row) => row.index === plan.index) || priorManifest[plan.index]
        const reuseFile = shouldReuseEofSceneAudioFile({
          fileExists: existsSync(outPath),
          storedLineHash: prior?.lineHash || null,
          currentLineHash: plan.lineHash,
          reuseSceneAudio,
          forceFreshAudio,
          voiceRegenerationMode,
        })
        if (reuseFile) {
          console.info(
            'eof:tts skip reuse',
            jobId,
            `scene=${plan.index + 1}`,
            'reason=scene_file',
            `lineHash=${plan.lineHash}`,
          )
          if (prior?.elevenLabsRequestId) {
            elevenLabsIds.set(plan.index, prior.elevenLabsRequestId)
          }
        }
      }

      const ttsConcurrency = resolveTtsConcurrency(job.voicePreset)
      await mapWithConcurrency(deduped, ttsConcurrency, async (group) => {
        const primaryIndex = group.indexes[0]
        const primaryPath = outPaths[primaryIndex]
        const prior =
          priorManifest.find((row) => row.index === primaryIndex) || priorManifest[primaryIndex]
        const primaryReuse = shouldReuseEofSceneAudioFile({
          fileExists: existsSync(primaryPath),
          storedLineHash: prior?.lineHash || null,
          currentLineHash: group.lineHash,
          reuseSceneAudio,
          forceFreshAudio,
          voiceRegenerationMode,
        })

        if (!primaryReuse) {
          const engine = voicePresetMeta.engine || 'edge'
          if (engine === 'elevenlabs') {
            // Budget counts whole TTS passes, not scenes — charging per scene blocked
            // every Short past 3 lines halfway through its own first build.
            const guard = eofTtsCreditGuardDecision({
              engine: 'elevenlabs',
              currentFingerprint: fingerprint,
              storedFingerprint: fingerprint,
              synthCount: priorSynthCount,
              voiceRegenerationMode,
            })
            if (guard.blocked) throw new Error(guard.reason)
            console.info(
              'eof:tts elevenlabs synthesize',
              jobId,
              `scene=${primaryIndex + 1}`,
              `lineHash=${group.lineHash}`,
              `pass=${priorSynthCount + 1}/${guard.limit}`,
            )
          } else {
            console.info('eof:tts edge synthesize', jobId, `scene=${primaryIndex + 1}`)
          }

          const ttsResult = await synthesizeEofSceneNarration({
            text: group.text,
            voicePreset: job.voicePreset,
            voiceSettings: job.voiceSettings,
            regenerateFromRequestId:
              voiceRegenerationMode && prior?.elevenLabsRequestId ? prior.elevenLabsRequestId : null,
            outPath: primaryPath,
          })
          const requestId =
            typeof ttsResult === 'object' && ttsResult.requestId ? ttsResult.requestId : null
          if (requestId) elevenLabsIds.set(primaryIndex, requestId)
          if (engine === 'elevenlabs') synthIncrements += 1
        }

        for (const idx of group.indexes.slice(1)) {
          const dest = outPaths[idx]
          const destPrior = priorManifest.find((row) => row.index === idx) || priorManifest[idx]
          const destReuse = shouldReuseEofSceneAudioFile({
            fileExists: existsSync(dest),
            storedLineHash: destPrior?.lineHash || null,
            currentLineHash: group.lineHash,
            reuseSceneAudio,
            forceFreshAudio,
            voiceRegenerationMode,
          })
          if (destReuse) continue
          copyFileSync(primaryPath, dest)
          console.info(
            'eof:tts skip reuse',
            jobId,
            `scene=${idx + 1}`,
            'reason=dedupe_copy',
            `from=${primaryIndex + 1}`,
          )
          const sharedId = elevenLabsIds.get(primaryIndex) || destPrior?.elevenLabsRequestId
          if (sharedId) elevenLabsIds.set(idx, sharedId)
        }

        await reportProgress(reuseSceneAudio ? 'mix' : 'tts', group.indexes[group.indexes.length - 1] + 1)
      })
      } finally {
        stopTtsHb()
      }

      const sceneManifest = scenePlans.map((plan, i) => {
        const prior = priorManifest.find((row) => row.index === i) || priorManifest[i]
        return {
          sceneId: plan.scene.id,
          index: i,
          audioPath: outPaths[i],
          caption: plan.scene.caption,
          imageQuery: plan.scene.imageQuery,
          lineHash: lineHashByIndex.get(i) || plan.lineHash,
          elevenLabsRequestId: elevenLabsIds.get(i) || prior?.elevenLabsRequestId || null,
          imageSource: prior?.imageSource || null,
          imageQueryUsed: prior?.imageQueryUsed || plan.scene.imageQuery,
          imageKey: prior?.imageKey || null,
          imageAttempt: Number(prior?.imageAttempt) || 0,
          imageKeyHistory: Array.isArray(prior?.imageKeyHistory)
            ? prior.imageKeyHistory.filter(Boolean)
            : prior?.imageKey
              ? [prior.imageKey]
              : [],
          imageTitle: prior?.imageTitle || null,
          imageYear: prior?.imageYear || null,
        }
      })

      const durations = await Promise.all(
        sceneManifest.map((entry) => probeAudioDurationSec(entry.audioPath)),
      )
      const sceneManifestWithDur = sceneManifest.map((entry, i) => ({
        ...entry,
        durationSec: durations[i],
      }))
      sceneManifestWithDur.sort((a, b) => a.index - b.index)

      await reportProgress('mix', sceneCount, { force: true })

      const wantNoMusic = shouldEofAllowNoMusic({ allowNoMusic }, job)
      const track = wantNoMusic ? null : await pickEofMusicTrackForTopic(job.topic, job.musicTrackId)
      const musicPath = resolveEofMusicTrackFilePath(track)
      const mixedPath = join(workDir, 'mixed.mp3')

      // ffmpeg concat/amix plus the durable base64 write are silent — beat through them
      // or the stale watchdog fails a job whose audio is actually fine.
      const stopMixHb = startProgressHeartbeat(async () => {
        await reportProgress('mix', sceneCount, { force: true })
      }, 4000)
      let saved
      try {
        await mixEofNarrationWithMusic({
          sceneAudioPaths: sceneManifestWithDur.map((s) => s.audioPath),
          musicFilePath: musicPath,
          musicVolume: job.musicVolume,
          musicStartSec: job.musicStartSec,
          musicEndSec: job.musicEndSec,
          outputPath: mixedPath,
        })

        if (preserveSceneImages) {
          await clearEofVideoOnlyArtifact(jobId).catch(() => {})
        } else {
          await clearEofVideoArtifact(jobId).catch(() => {})
        }

        // Write durable mix first (overwrites prior blob). Never clear-before-save —
        // that left hasDurableAudio=false and continue-build re-ran TTS.
        saved = await saveEofMixedAudioArtifact(jobId, mixedPath)
      } finally {
        stopMixHb()
      }
      if (!saved) {
        console.warn('[eof-production] durable mixed audio save failed — keeping on-disk mix', jobId)
      }

      await reportProgress('done', sceneCount, { force: true })
      await updateEofProductionRenderProgress(jobId, null)

      const nextSynthCount = voiceRegenerationMode
        ? job.ttsSynthCount
        : nextEofTtsSynthCount({ priorCount: priorSynthCount, scenesSynthesized: synthIncrements })

      const regenPatch = voiceRegenerationMode
        ? { voiceRegenerationCount: incrementEofVoiceRegenerationCount(job) }
        : preserveSceneImages
          ? {}
          : resetEofVoiceRegenerationBaseline(job.script)

      return updateEofProductionJob(jobId, {
        status: EOF_PRODUCTION_JOB_STATUS.RENDERED,
        narrationManifest: sceneManifestWithDur,
        mixedAudioPath: eofProductionMixedAudioRelPath(jobId),
        renderOutputPath: null,
        errorMessage: null,
        ttsAudioHash: fingerprint,
        ttsSynthCount: nextSynthCount,
        musicTrackId: wantNoMusic ? null : track?.id || null,
        ...regenPatch,
        script: {
          ...job.script,
          scenes: job.script.scenes.map((scene, i) => ({
            ...scene,
            durationSec: sceneManifestWithDur[i]?.durationSec ?? scene.durationSec,
          })),
        },
      })
    } catch (e) {
      await markEofProductionJobFailed(jobId, e instanceof Error ? e.message : 'Render failed')
      throw e
    }
  } finally {
    audioRenderLocks.delete(jobId)
  }
}
