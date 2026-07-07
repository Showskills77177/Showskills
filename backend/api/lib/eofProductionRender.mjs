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

const MAX_INLINE_AUDIO_BYTES = 3_500_000

export async function readEofMixedAudioInline(jobId) {
  const mixedPath = join(eofProductionWorkDir(jobId), 'mixed.mp3')
  try {
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

  async function reportProgress(stage, sceneIndex = 0) {
    const progress = buildEofRenderProgress({
      stage,
      sceneIndex,
      sceneCount,
      startedAt: renderStartedAt,
      estimatedTotalSec,
    })
    await updateEofProductionRenderProgress(jobId, progress)
    return progress
  }

  try {
    const workDir = eofProductionWorkDir(jobId)
    const sceneManifest = []

    await reportProgress('tts', 0)

    for (let i = 0; i < job.script.scenes.length; i += 1) {
      const scene = job.script.scenes[i]
      const outPath = join(workDir, `scene-${i + 1}.mp3`)
      await synthesizeEofSceneNarration({
        text: scene.narration,
        voicePreset: job.voicePreset,
        outPath,
      })
      const durationSec = await probeAudioDurationSec(outPath)
      sceneManifest.push({
        sceneId: scene.id,
        index: i,
        audioPath: outPath,
        durationSec,
        caption: scene.caption,
        imageQuery: scene.imageQuery,
      })
      await reportProgress('tts', i + 1)
    }

    await reportProgress('mix', sceneCount)

    const track = job.musicTrackId ? await getEofMusicTrack(job.musicTrackId) : null
    const musicPath = resolveEofMusicTrackFilePath(track)
    const mixedPath = join(workDir, 'mixed.mp3')

    const mix = await mixEofNarrationWithMusic({
      sceneAudioPaths: sceneManifest.map((s) => s.audioPath),
      musicFilePath: musicPath,
      musicVolume: job.musicVolume,
      outputPath: mixedPath,
    })
    void mix

    await reportProgress('done', sceneCount)
    await updateEofProductionRenderProgress(jobId, null)

    return updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.RENDERED,
      narrationManifest: sceneManifest,
      mixedAudioPath: eofProductionMixedAudioRelPath(jobId),
      renderOutputPath: null,
      errorMessage: null,
      script: {
        ...job.script,
        scenes: job.script.scenes.map((scene, i) => ({
          ...scene,
          durationSec: sceneManifest[i]?.durationSec ?? scene.durationSec,
        })),
      },
    })
  } catch (e) {
    await markEofProductionJobFailed(jobId, e instanceof Error ? e.message : 'Render failed')
    throw e
  }
}
