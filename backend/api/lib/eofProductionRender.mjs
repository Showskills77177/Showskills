import { join } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import { EOF_PRODUCTION_JOB_STATUS, buildEofRenderProgress, estimateEofRenderDurationSec } from '../../../shared/eofProduction.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  markEofProductionJobFailed,
  updateEofProductionRenderProgress,
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
  clearEofMixedAudioArtifact,
} from './eofProductionArtifacts.mjs'

const TTS_CONCURRENCY = Number(process.env.EOF_TTS_CONCURRENCY) || 3

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
 */
export async function renderEofProductionAudio(jobId) {
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

    let scenesDone = 0
    const sceneManifest = await mapWithConcurrency(job.script.scenes, TTS_CONCURRENCY, async (scene, i) => {
      const outPath = join(workDir, `scene-${i + 1}.mp3`)
      await synthesizeEofSceneNarration({
        text: scene.narration,
        voicePreset: job.voicePreset,
        voiceSettings: job.voiceSettings,
        outPath,
      })
      scenesDone += 1
      await reportProgress('tts', scenesDone)
      return {
        sceneId: scene.id,
        index: i,
        audioPath: outPath,
        caption: scene.caption,
        imageQuery: scene.imageQuery,
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
    await clearEofVideoArtifact(jobId).catch(() => {})
    await clearEofMixedAudioArtifact(jobId).catch(() => {})
    await saveEofMixedAudioArtifact(jobId, mixedPath)

    return updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.RENDERED,
      narrationManifest: sceneManifestWithDur,
      mixedAudioPath: eofProductionMixedAudioRelPath(jobId),
      renderOutputPath: null,
      errorMessage: null,
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
