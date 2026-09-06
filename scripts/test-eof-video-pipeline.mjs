#!/usr/bin/env node
/** Verify EOF image Short pipeline: stock images + silent 9:16 MP4 (no TTS). */
import { join } from 'node:path'
import { existsSync, mkdirSync, statSync, rmSync } from 'node:fs'

process.env.SQLITE_PATH = 'db/eof-video-pipeline-test.sqlite'
try {
  rmSync('db/eof-video-pipeline-test.sqlite', { force: true })
} catch {
  /* ok */
}

const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
const {
  createEofProductionJob,
  updateEofProductionJob,
} = await import('../backend/api/lib/eofProductionJobs.mjs')
const { renderEofProductionVideoJob } = await import('../backend/api/lib/eofProductionRenderVideo.mjs')
const { eofProductionWorkDir } = await import('../backend/api/lib/eofSceneTts.mjs')
const { isFfmpegAvailable } = await import('../backend/api/lib/eofFfmpeg.mjs')
const { ensureEofVideoOnDisk } = await import('../backend/api/lib/eofProductionArtifacts.mjs')

if (!(await isFfmpegAvailable())) {
  console.error('ffmpeg required')
  process.exit(1)
}

await ensureEofProductionSchema()

const job = await createEofProductionJob({
  topic: 'Pipeline test',
  createdBy: 'test',
  format: 'listicle',
  manualDraft: 'A deterministic local render test that does not require an AI provider.',
})
const scenes = [
  {
    caption: 'The first scene verifies image generation.',
    narration: 'The first scene verifies image generation.',
    imageQuery: 'football stadium',
    durationSec: 3,
  },
  {
    caption: 'The second scene verifies video encoding.',
    narration: 'The second scene verifies video encoding.',
    imageQuery: 'football training',
    durationSec: 3,
  },
]
const prepared = await updateEofProductionJob(job.id, {
  script: {
    ...job.script,
    scenes,
    plainTextDraft: scenes.map((scene) => scene.narration).join(' '),
  },
})
const workDir = eofProductionWorkDir(job.id)
mkdirSync(workDir, { recursive: true })

const finished = await renderEofProductionVideoJob(job.id)
const videoPath = join(workDir, 'short.mp4')

if (finished.status !== 'video_rendered') throw new Error(`expected video_rendered, got ${finished.status}`)
if (!existsSync(videoPath)) throw new Error('short.mp4 missing')
if (statSync(videoPath).size < 10_000) throw new Error('short.mp4 too small')

for (let i = 0; i < prepared.script.scenes.length; i += 1) {
  if (!existsSync(join(workDir, `scene-${i + 1}.jpg`))) throw new Error(`scene-${i + 1}.jpg missing`)
}

// Durable restore after wipe
rmSync(workDir, { recursive: true, force: true })
const restored = await ensureEofVideoOnDisk(job.id)
if (!restored || !existsSync(restored)) throw new Error('durable video restore failed')

console.log('EOF video pipeline test passed —', restored)
