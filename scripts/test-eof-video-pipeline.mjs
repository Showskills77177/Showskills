#!/usr/bin/env node
/** Verify EOF video pipeline: images per scene + mixed MP4 output (no TTS). */
import { join } from 'node:path'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

process.env.SQLITE_PATH = 'db/eof-video-pipeline-test.sqlite'

const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
const { ensureEofMusicCatalogSeeded } = await import('../backend/api/lib/eofMusicTracks.mjs')
const { createEofProductionJob, updateEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
const { renderEofProductionVideoJob } = await import('../backend/api/lib/eofProductionRenderVideo.mjs')
const { eofProductionWorkDir } = await import('../backend/api/lib/eofSceneTts.mjs')
const { runFfmpeg, isFfmpegAvailable } = await import('../backend/api/lib/eofFfmpeg.mjs')
const { EOF_PRODUCTION_JOB_STATUS } = await import('../shared/eofProduction.mjs')

if (!(await isFfmpegAvailable())) {
  console.error('ffmpeg required')
  process.exit(1)
}

await ensureEofProductionSchema()
await ensureEofMusicCatalogSeeded()

const job = await createEofProductionJob({ topic: 'Pipeline test', createdBy: 'test', voicePreset: 'british' })
const workDir = eofProductionWorkDir(job.id)
mkdirSync(workDir, { recursive: true })

const sceneManifest = []
for (let i = 0; i < job.script.scenes.length; i += 1) {
  const outPath = join(workDir, `scene-${i + 1}.mp3`)
  await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3', '-q:a', '4', outPath])
  sceneManifest.push({
    sceneId: job.script.scenes[i].id,
    index: i,
    audioPath: outPath,
    durationSec: 3,
    caption: job.script.scenes[i].caption,
    imageQuery: job.script.scenes[i].imageQuery,
  })
}

const listFile = join(workDir, 'narration.concat.txt')
const listBody = sceneManifest.map((s) => `file '${s.audioPath.replace(/'/g, "'\\''")}'`).join('\n')
await writeFile(listFile, listBody)
const mixedPath = join(workDir, 'mixed.mp3')
await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', mixedPath])

await updateEofProductionJob(job.id, {
  status: EOF_PRODUCTION_JOB_STATUS.RENDERED,
  narrationManifest: sceneManifest,
  mixedAudioPath: `storage/eof/jobs/${job.id}/mixed.mp3`,
})

const finished = await renderEofProductionVideoJob(job.id)
const videoPath = join(workDir, 'short.mp4')

if (finished.status !== 'video_rendered') throw new Error(`expected video_rendered, got ${finished.status}`)
if (!existsSync(videoPath)) throw new Error('short.mp4 missing')
if (statSync(videoPath).size < 10_000) throw new Error('short.mp4 too small')

for (let i = 0; i < sceneManifest.length; i += 1) {
  if (!existsSync(join(workDir, `scene-${i + 1}.jpg`))) throw new Error(`scene-${i + 1}.jpg missing`)
}

console.log('EOF video pipeline test passed —', videoPath)
