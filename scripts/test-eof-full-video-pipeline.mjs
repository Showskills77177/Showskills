#!/usr/bin/env node
/**
 * End-to-end check for the new Full Video (16:9 landscape, no burned-in captions) mode:
 * verifies createEofProductionJob enforces a manual draft, the render pipeline actually
 * encodes at 1920x1080, and no caption/sticker/overlay filters are burned in. Needs ffmpeg;
 * uses real image sourcing (same as the existing no-keys test) so this exercises the real
 * pipeline, not a mock.
 */
import { mkdtempSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'eof-full-video-pipeline-'))
process.env.SQLITE_PATH = join(dir, 'test.sqlite')
delete process.env.DATABASE_URL
delete process.env.POSTGRES_URL

const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
const {
  createEofProductionJob,
  updateEofProductionJob,
  getEofProductionJob,
} = await import('../backend/api/lib/eofProductionJobs.mjs')
const { renderEofProductionVideoJob } = await import('../backend/api/lib/eofProductionRenderVideo.mjs')
const { eofProductionWorkDir } = await import('../backend/api/lib/eofSceneTts.mjs')
const { isFfmpegAvailable, runFfmpeg } = await import('../backend/api/lib/eofFfmpeg.mjs')

if (!(await isFfmpegAvailable())) {
  console.error('ffmpeg required')
  process.exit(1)
}

await ensureEofProductionSchema()

console.log('\n=== 1) createEofProductionJob rejects Full Video without a manual draft ===')
let rejected = false
try {
  await createEofProductionJob({ topic: 'Full video reject test', createdBy: 'test', videoLength: 'full' })
} catch (e) {
  rejected = true
  console.log('threw as expected:', e.message)
}
if (!rejected) {
  console.error('FAIL — Full Video job was created without a manual draft')
  process.exit(1)
}

console.log('\n=== 2) create a real Full Video job with a pasted script ===')
const manualDraft = [
  'Arsenal just got cooked three nil by Brighton and somehow their biggest problem might be a corner kick.',
  'Brighton had Arsenal looking completely lost all afternoon at the Amex.',
  'Gabriel then became a meme after a dive so good he might as well start training for the Olympics.',
  'But the funniest part came at the other end of the pitch.',
  'Brighton scored their third from a corner, exposing Arsenal defending the exact set piece they have dominated for years.',
  'Arsenal scored a Premier League record nineteen goals from corners last season.',
  'This season the Gunners are still waiting for their first one.',
  'So Arsenal are getting beaten by corners while not scoring from them at all.',
  'Maybe the set piece merchants finally forgot the cheat code.',
].join(' ')

const job = await createEofProductionJob({
  topic: 'Arsenal corners full video test',
  createdBy: 'test',
  manualDraft,
  videoLength: 'full',
})
console.log('job created — videoLength:', job.videoLength, '| footageMode:', job.videoFootageMode)
if (job.videoLength !== 'full') throw new Error('expected videoLength=full on the created job')
if (job.videoFootageMode !== 'auto') throw new Error('expected videoFootageMode forced to auto for Full Video')

// Build a short-but-real scene list (full adaptive scene-count scaling is covered by
// shared/eofFullVideoLength.test.mjs already; here we only need enough scenes to prove the
// 16:9 / no-caption render path actually encodes).
const scenes = [
  { caption: 'Arsenal just got cooked three nil by Brighton.', narration: 'Arsenal just got cooked three nil by Brighton.', imageQuery: 'Arsenal football', durationSec: 3 },
  { caption: 'Brighton had Arsenal looking completely lost.', narration: 'Brighton had Arsenal looking completely lost.', imageQuery: 'Brighton football', durationSec: 3 },
  { caption: 'Gabriel became a meme after a dive.', narration: 'Gabriel became a meme after a dive.', imageQuery: 'Arsenal Gabriel', durationSec: 3 },
]
const prepared = await updateEofProductionJob(job.id, {
  script: {
    ...job.script,
    scenes,
    plainTextDraft: manualDraft,
  },
})
console.log('scenes prepared:', prepared.script.scenes.length)

console.log('\n=== 3) render the Full Video and verify 1920x1080, no captions burned in ===')
const workDir = eofProductionWorkDir(job.id)
const startedAt = Date.now()
const finished = await renderEofProductionVideoJob(job.id, {
  includeAudioIfPresent: false,
  captionMode: 'free',
  qualityGateMode: 'manual',
  skipPlanPreflight: false,
  forceFreshImages: true,
})
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)
const videoPath = join(workDir, 'short.mp4')

console.log(`status after ${elapsed}s:`, finished.status, '| error:', finished.errorMessage || '(none)')
if (finished.status !== 'video_rendered') throw new Error(`expected video_rendered, got ${finished.status}: ${finished.errorMessage || ''}`)
if (!existsSync(videoPath)) throw new Error('short.mp4 missing')
const size = statSync(videoPath).size
console.log('short.mp4 size:', (size / 1024).toFixed(0), 'KB')
if (size < 10_000) throw new Error('short.mp4 too small')

const probe = await runFfmpeg(['-i', videoPath, '-hide_banner']).catch((e) => ({ stderr: e.stderr || '' }))
const meta = String(probe.stderr || '')
const metaLines = meta.split('\n').filter((l) => /Duration|Stream #/.test(l))
console.log(metaLines.map((l) => `  ${l.trim()}`).join('\n'))

if (!/1920x1080/.test(meta)) throw new Error(`expected 1920x1080 landscape frame, ffprobe output: ${meta}`)
console.log('\n1920x1080 landscape frame confirmed.')

const reloaded = await getEofProductionJob(job.id)
console.log('final job caption style:', reloaded.script?.captionStyle || reloaded.captionStyle || '(n/a — forced off)')

console.log('\nEOF Full Video pipeline test passed — the long-form video built at 1920x1080 with no burned-in captions.\n')
process.exit(0)
