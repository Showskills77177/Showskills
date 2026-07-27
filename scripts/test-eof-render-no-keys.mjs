#!/usr/bin/env node
/**
 * A Short must RENDER in the worst case: no SerpAPI/Oxylabs/vision/TTS keys, pop inset
 * forced to Always, and stills that may all end up placeholders.
 *
 * This is the "Why Marc Cucurella doesn't cut his hair" regression — that Short kept
 * failing because every image filter, quality check, and storage cap could hard-fail the
 * whole build. Needs ffmpeg; set VERIFY_TOPIC to try another headline, VERCEL=1 to use the
 * tighter serverless caps.
 */
import { mkdtempSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'eof-render-no-keys-'))
process.env.SQLITE_PATH = join(dir, 'test.sqlite')
delete process.env.DATABASE_URL
delete process.env.POSTGRES_URL
process.env.EOF_SHORT_QUALITY_GATE = 'auto'

const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
const { query } = await import('../backend/api/lib/db.mjs')
const { getEofProductionJob, updateEofProductionJob } = await import(
  '../backend/api/lib/eofProductionJobs.mjs'
)
const { renderEofProductionVideoJob } = await import(
  '../backend/api/lib/eofProductionRenderVideo.mjs'
)
const { eofProductionWorkDir } = await import('../backend/api/lib/eofSceneTts.mjs')

await ensureEofProductionSchema()

const topic = process.env.VERIFY_TOPIC || "Why Marc Cucurella doesn't cut his hair"
const scenes = [
  { caption: 'Cucurella hit back at the hair jokes.', narration: 'Cucurella hit back at the hair jokes.', imageQuery: 'Marc Cucurella Chelsea', durationSec: 4 },
  { caption: 'He says it is personal, not a stunt.', narration: 'He says it is personal, not a stunt.', imageQuery: 'Marc Cucurella close up', durationSec: 4 },
  { caption: 'The backlash says more about us.', narration: 'The backlash says more about us.', imageQuery: 'Marc Cucurella match', durationSec: 4 },
  { caption: 'Chelsea fans backed him fast.', narration: 'Chelsea fans backed him fast.', imageQuery: 'Chelsea fans Stamford Bridge', durationSec: 4 },
  { caption: 'So who is really out of line?', narration: 'So who is really out of line?', imageQuery: 'Marc Cucurella interview', durationSec: 4 },
]

const jobId = 'cucurella-hair-job'
await query(
  `INSERT INTO eof_production_jobs (id, topic, title, status, script_json, script_source, created_by, caption_style, overlay_moments)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  [
    jobId,
    topic,
    topic,
    'rendered',
    JSON.stringify({ topic, title: topic, format: 'debate', scenes, plainTextDraft: scenes.map((s) => s.narration).join(' ') }),
    'anthropic',
    'test',
    'off',
    // Pop inset "always" used to hard-block this build before ffmpeg even started.
    'always',
  ],
)

// Stand in for the mix step's output (no TTS keys here).
const workDir = eofProductionWorkDir(jobId)
mkdirSync(workDir, { recursive: true })
const { runFfmpeg, isFfmpegAvailable } = await import('../backend/api/lib/eofFfmpeg.mjs')
if (!(await isFfmpegAvailable())) {
  console.error('ffmpeg required for this test')
  process.exit(1)
}
const mixedPath = join(workDir, 'mixed.mp3')
await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', '20', '-q:a', '9', mixedPath])
await updateEofProductionJob(jobId, {
  mixedAudioPath: `storage/eof/jobs/${jobId}/mixed.mp3`,
  narrationManifest: scenes.map((s, i) => ({
    index: i,
    durationSec: s.durationSec,
    caption: s.caption,
    imageQuery: s.imageQuery,
    audioPath: join(workDir, `scene-${i + 1}.mp3`),
  })),
})

console.log(`\n=== Building "${topic}" with zero image keys (worst case) ===\n`)
const startedAt = Date.now()
let failure = null
try {
  await renderEofProductionVideoJob(jobId, {
    includeAudioIfPresent: true,
    captionMode: 'free',
    qualityGateMode: 'manual',
    skipPlanPreflight: false,
    forceFreshImages: true,
  })
} catch (e) {
  failure = e instanceof Error ? e.message : String(e)
}

const job = await getEofProductionJob(jobId)
const videoAbs = join(workDir, 'short.mp4')
const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1)

console.log(`\n--- result after ${elapsed}s ---`)
console.log('status      :', job?.status)
console.log('thrown      :', failure || '(nothing)')
console.log('job message :', job?.errorMessage || '(none)')
console.log('short.mp4   :', existsSync(videoAbs) ? `${(statSync(videoAbs).size / 1024).toFixed(0)} KB` : 'MISSING')

const ok = job?.status === 'video_rendered' && existsSync(videoAbs) && statSync(videoAbs).size > 10_000
if (ok) {
  const probe = await runFfmpeg(['-i', videoAbs, '-hide_banner']).catch((e) => ({ stderr: e.stderr || '' }))
  const meta = String(probe.stderr || '').split('\n').filter((l) => /Duration|Stream #/.test(l))
  console.log(meta.map((l) => `  ${l.trim()}`).join('\n'))
  console.log('\nEOF render-without-keys test passed — the Short built.\n')
} else {
  console.error('\nFAIL — the Short did not render with no provider keys.\n')
}
process.exit(ok ? 0 : 1)
