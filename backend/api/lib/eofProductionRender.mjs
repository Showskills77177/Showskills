import { join } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import {
  EOF_PRODUCTION_JOB_STATUS,
  EOF_VOICE_PRESETS,
  buildEofRenderProgress,
  estimateEofRenderDurationSec,
} from '../../../shared/eofProduction.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  markEofProductionJobFailed,
  updateEofProductionRenderProgress,
  resetEofVoiceRegenerationBaseline,
  incrementEofVoiceRegenerationCount,
} from './eofProductionJobs.mjs'
import { getEofMusicTrack, resolveEofMusicTrackFilePath } from './eofMusicTracks.mjs'
import {
  eofProductionWorkDir,
  eofProductionMixedAudioRelPath,
  synthesizeEofSceneNarration,
  probeAudioDurationSec,
} from './eofSceneTts.mjs'
import { mixEofNarrationWithMusic, isFfmpegAvailable } from './eofAudioMix.mjs'
import { hasBundledFfmpeg } from './eofFfmpeg.mjs'
import { mapWithConcurrency, createThrottledWriter } from './eofAsyncPool.mjs'
import {
  saveEofMixedAudioArtifact,
  clearEofVideoArtifact,
  clearEofVideoOnlyArtifact,
  clearEofMixedAudioArtifact,
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

export async function readEofMixedAudioInline(jobId) {
  try {
    const { ensureEofMixedAudioOnDisk } = await import('./eofProductionArtifacts.mjs')
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
 * @param {{ preserveSceneImages?: boolean, voiceRegenerationMode?: boolean }} [opts]
 */
export async function renderEofProductionAudio(jobId, opts = {}) {
  const preserveSceneImages = opts.preserveSceneImages === true
  const voiceRegenerationMode = opts.voiceRegenerationMode === true
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const ffmpegOk = (await hasBundledFfmpeg()) || (await isFfmpegAvailable())
  if (!ffmpegOk) {
    throw new Error(
      'ffmpeg is not available for audio render. Ensure ffmpeg-static is installed or set FFMPEG_PATH.',
    )
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

  const throttledProgress = createThrottledWriter(
    (progress) => updateEofProductionRenderProgress(jobId, progress),
    700,
  )

  try {
    const workDir = eofProductionWorkDir(jobId)

    await reportProgress('tts', 0, { force: true })

    const priorManifest = Array.isArray(job.narrationManifest) ? job.narrationManifest : []

    let scenesDone = 0
    const ttsConcurrency = resolveTtsConcurrency(job.voicePreset)
    const sceneManifest = await mapWithConcurrency(job.script.scenes, ttsConcurrency, async (scene, i) => {
      const outPath = join(workDir, `scene-${i + 1}.mp3`)
      const prior = priorManifest.find((row) => row.index === i) || priorManifest[i]
      const ttsResult = await synthesizeEofSceneNarration({
        text: scene.narration,
        voicePreset: job.voicePreset,
        voiceSettings: job.voiceSettings,
        regenerateFromRequestId:
          voiceRegenerationMode && prior?.elevenLabsRequestId ? prior.elevenLabsRequestId : null,
        outPath,
      })
      const audioPath = typeof ttsResult === 'string' ? ttsResult : ttsResult.outPath
      scenesDone += 1
      await reportProgress('tts', scenesDone)
      return {
        sceneId: scene.id,
        index: i,
        audioPath,
        caption: scene.caption,
        imageQuery: scene.imageQuery,
        elevenLabsRequestId:
          typeof ttsResult === 'object' && ttsResult.requestId ? ttsResult.requestId : prior?.elevenLabsRequestId || null,
        imageSource: prior?.imageSource || null,
        imageQueryUsed: prior?.imageQueryUsed || scene.imageQuery,
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

    const track = job.musicTrackId ? await getEofMusicTrack(job.musicTrackId) : null
    const musicPath = resolveEofMusicTrackFilePath(track)
    const mixedPath = join(workDir, 'mixed.mp3')

    const mix = await mixEofNarrationWithMusic({
      sceneAudioPaths: sceneManifestWithDur.map((s) => s.audioPath),
      musicFilePath: musicPath,
      musicVolume: job.musicVolume,
      outputPath: mixedPath,
    })
    void mix

    await reportProgress('done', sceneCount, { force: true })
    await updateEofProductionRenderProgress(jobId, null)

    // Durable copy for Vercel: next request may land on a cold instance without /tmp files.
    if (preserveSceneImages) {
      await clearEofVideoOnlyArtifact(jobId).catch(() => {})
    } else {
      await clearEofVideoArtifact(jobId).catch(() => {})
    }
    await clearEofMixedAudioArtifact(jobId).catch(() => {})
    await saveEofMixedAudioArtifact(jobId, mixedPath)

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
}
