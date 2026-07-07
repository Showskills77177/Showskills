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
  const { createEofMusicTrack, listEofMusicTracks, pickEofMusicTrackForTopic, ensureEofMusicCatalogSeeded } =
    await import('../backend/api/lib/eofMusicTracks.mjs')
  const { createEofProductionJob, getEofProductionJob, listEofProductionJobs, deleteEofProductionJob } = await import(
    '../backend/api/lib/eofProductionJobs.mjs'
  )
  const handler = (await import('../backend/api/admin/eof-production.js')).default
  const { signAdminSession } = await import('../backend/api/lib/adminAuth.mjs')

  await ensureEofProductionSchema()

  const seeded = await ensureEofMusicCatalogSeeded()
  if (seeded.length < 1) throw new Error('music catalog seed failed')

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

  const token = await signAdminSession({ sub: process.env.ADMIN_USER, role: 'admin' })
  const req = { method: 'GET', headers: { cookie: `admin_session=${token}` }, url: '/api/admin/eof-production' }
  const res = { statusCode: 200, headers: {}, setHeader() {}, end(body) { this.body = body } }
  await handler(req, res)
  const payload = JSON.parse(res.body)
  if (res.statusCode !== 200 || !payload.ok) throw new Error('production GET failed')
  if (!payload.tracks.length) throw new Error('production GET returned no tracks')

  const deleted = await deleteEofProductionJob(job.id)
  if (!deleted) throw new Error('delete job failed')
  const gone = await getEofProductionJob(job.id)
  if (gone) throw new Error('job still exists after delete')

  const job2 = await createEofProductionJob({
    topic: 'Delete via API',
    createdBy: 'test',
    voicePreset: 'british',
  })
  const delReq = {
    method: 'POST',
    headers: { cookie: `admin_session=${token}` },
    url: '/api/admin/eof-production',
    body: { action: 'delete', jobId: job2.id },
  }
  const delRes = { statusCode: 200, headers: {}, setHeader() {}, end(body) { this.body = body } }
  await handler(delReq, delRes)
  const delPayload = JSON.parse(delRes.body)
  if (delRes.statusCode !== 200 || !delPayload.ok) throw new Error('production DELETE failed')

  console.log('EOF production lib smoke tests passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
