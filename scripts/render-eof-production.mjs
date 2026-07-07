#!/usr/bin/env node
/**
 * CLI: render EOF production job audio and/or video locally.
 *
 * Usage:
 *   node scripts/render-eof-production.mjs --job <id> --audio
 *   node scripts/render-eof-production.mjs --job <id> --video
 *   node scripts/render-eof-production.mjs --topic "Cristiano Ronaldo" --audio --video
 */
import { parseArgs } from 'node:util'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const { values } = parseArgs({
  options: {
    job: { type: 'string', short: 'j' },
    topic: { type: 'string', short: 't' },
    audio: { type: 'boolean', default: false },
    video: { type: 'boolean', default: false },
    voice: { type: 'string', default: 'british' },
  },
})

const wantAudio = Boolean(values.audio)
const wantVideo = Boolean(values.video)

if (!wantAudio && !wantVideo) {
  console.error('Pass --audio and/or --video')
  process.exit(1)
}

if (!values.job && !values.topic) {
  console.error('Pass --job <id> or --topic "Player name"')
  process.exit(1)
}

process.chdir(root)
if (!process.env.SQLITE_PATH) {
  process.env.SQLITE_PATH = 'db/showskills.sqlite'
}

async function main() {
  const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
  const { ensureEofMusicCatalogSeeded } = await import('../backend/api/lib/eofMusicTracks.mjs')
  const { createEofProductionJob, getEofProductionJob } = await import('../backend/api/lib/eofProductionJobs.mjs')
  const { renderEofProductionAudio } = await import('../backend/api/lib/eofProductionRender.mjs')
  const { renderEofProductionVideoJob } = await import('../backend/api/lib/eofProductionRenderVideo.mjs')
  const { isFfmpegAvailable } = await import('../backend/api/lib/eofAudioMix.mjs')

  await ensureEofProductionSchema()
  await ensureEofMusicCatalogSeeded()

  if (!(await isFfmpegAvailable())) {
    throw new Error('ffmpeg is not available — install ffmpeg-static or set FFMPEG_PATH')
  }

  let jobId = values.job?.trim() || ''
  if (!jobId) {
    const job = await createEofProductionJob({
      topic: values.topic.trim(),
      createdBy: 'cli',
      voicePreset: values.voice,
    })
    jobId = job.id
    console.log(`Created job ${jobId} — ${job.title}`)
  }

  let job = await getEofProductionJob(jobId)
  if (!job) throw new Error(`Job not found: ${jobId}`)

  if (wantAudio) {
    console.log(`Rendering audio for ${jobId}…`)
    job = await renderEofProductionAudio(jobId)
    console.log(`Audio done — ${job.mixedAudioPath}`)
  }

  if (wantVideo) {
    job = await getEofProductionJob(jobId)
    if (!job?.mixedAudioPath && job?.status !== 'rendered' && job?.status !== 'video_rendered') {
      throw new Error('Render audio first (--audio) before --video')
    }
    console.log(`Rendering video for ${jobId}…`)
    job = await renderEofProductionVideoJob(jobId)
    console.log(`Video done — ${job.renderOutputPath}`)
  }

  console.log('Done.', job.status)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
