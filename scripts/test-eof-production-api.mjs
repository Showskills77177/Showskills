#!/usr/bin/env node
/** Smoke test EOF production + music catalog (no ffmpeg render). */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
process.env.SQLITE_PATH = 'db/eof-production-test.sqlite'
process.env.ADMIN_USER = 'eof-prod-test'
process.env.ADMIN_PASSWORD = 'eof-prod-test-pass-12'
process.env.ADMIN_JWT_SECRET = 'eof-prod-test-jwt-secret-32chars!!'

const failures = []

async function main() {
  const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
  const { createEofMusicTrack, listEofMusicTracks, pickEofMusicTrackForTopic } = await import(
    '../backend/api/lib/eofMusicTracks.mjs'
  )
  const { createEofProductionJob, getEofProductionJob } = await import(
    '../backend/api/lib/eofProductionJobs.mjs'
  )

  await ensureEofProductionSchema()

  await createEofMusicTrack({
    title: 'Test neutral',
    mood: 'neutral',
    publicUrl: '/eof/music/test-neutral.mp3',
    isDefault: true,
  })

  const picked = await pickEofMusicTrackForTopic('Ronaldo goals record')
  if (!picked) throw new Error('no track picked')

  const job = await createEofProductionJob({
    topic: 'Lionel Messi',
    createdBy: 'test',
    voicePreset: 'british',
  })
  if (!job?.script?.scenes?.length) throw new Error('no scenes')
  const loaded = await getEofProductionJob(job.id)
  if (loaded.musicTrackId !== picked.id) throw new Error('music not linked')

  const tracks = await listEofMusicTracks()
  if (tracks.length < 1) throw new Error('no tracks')

  console.log('EOF production lib smoke tests passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
