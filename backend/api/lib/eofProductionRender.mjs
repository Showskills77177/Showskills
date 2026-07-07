import { join } from 'node:path'
import { EOF_PRODUCTION_JOB_STATUS } from '../../../shared/eofProduction.mjs'
import {
  getEofProductionJob,
  updateEofProductionJob,
  markEofProductionJobFailed,
} from './eofProductionJobs.mjs'
import { getEofMusicTrack, resolveEofMusicTrackFilePath } from './eofMusicTracks.mjs'
import { eofProductionWorkDir, synthesizeEofSceneNarration, probeAudioDurationSec } from './eofSceneTts.mjs'
import { mixEofNarrationWithMusic, isFfmpegAvailable } from './eofAudioMix.mjs'

/**
 * Generate per-scene TTS and mix with catalog music bed.
 * @param {string} jobId
 */
export async function renderEofProductionAudio(jobId) {
  const job = await getEofProductionJob(jobId)
  if (!job) throw new Error('Production job not found.')
  if (!job.script?.scenes?.length) throw new Error('Job has no script scenes.')

  const ffmpegOk = await isFfmpegAvailable()
  if (!ffmpegOk) {
    throw new Error('ffmpeg is not installed on this server. Install ffmpeg to render audio.')
  }

  await updateEofProductionJob(jobId, {
    status: EOF_PRODUCTION_JOB_STATUS.RENDERING,
    errorMessage: null,
  })

  try {
    const workDir = eofProductionWorkDir(jobId)
    const sceneManifest = []

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
    }

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

    return updateEofProductionJob(jobId, {
      status: EOF_PRODUCTION_JOB_STATUS.RENDERED,
      narrationManifest: sceneManifest,
      mixedAudioPath: `storage/eof/jobs/${jobId}/mixed.mp3`,
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
