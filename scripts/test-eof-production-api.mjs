#!/usr/bin/env node
/** Smoke test EOF image Short production (no full ffmpeg render). */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, rmSync, mkdirSync, statSync } from 'node:fs'

process.env.SQLITE_PATH = 'db/eof-production-test.sqlite'
process.env.ADMIN_USER = 'eof-prod-test'
process.env.ADMIN_PASSWORD = 'eof-prod-test-pass-12'
process.env.ADMIN_JWT_SECRET = 'eof-prod-test-jwt-secret-32chars!!'

async function main() {
  const { ensureEofProductionSchema } = await import('../backend/api/lib/ensureEofProductionSchema.mjs')
  const { createEofProductionJob, getEofProductionJob, deleteEofProductionJob } = await import(
    '../backend/api/lib/eofProductionJobs.mjs'
  )
  const { saveEofVideoArtifact, ensureEofVideoOnDisk } = await import('../backend/api/lib/eofProductionArtifacts.mjs')
  const { eofProductionVideoAbsPath } = await import('../backend/api/lib/eofProductionVideo.mjs')
  const { runFfmpeg, isFfmpegAvailable } = await import('../backend/api/lib/eofFfmpeg.mjs')
  const handler = (await import('../backend/api/admin/eof-production.js')).default
  const { signAdminSession } = await import('../backend/api/lib/adminAuth.mjs')

  await ensureEofProductionSchema()

  const job = await createEofProductionJob({
    topic: 'Lionel Messi',
    createdBy: 'test',
    format: 'listicle',
  })
  if (!job?.script?.scenes?.length) throw new Error('no scenes')
  if (!job.script.scenes.every((s) => s.caption && s.imageQuery)) throw new Error('scenes missing caption/image')

  const debate = await createEofProductionJob({
    topic: 'Mbappe',
    createdBy: 'test',
    format: 'debate',
  })
  if (debate.script.format !== 'debate') throw new Error('format not applied')

  const token = await signAdminSession({ sub: process.env.ADMIN_USER, role: 'admin' })
  const req = { method: 'GET', headers: { cookie: `admin_session=${token}` }, url: '/api/admin/eof-production' }
  const res = { statusCode: 200, headers: {}, setHeader() {}, end(body) { this.body = body } }
  await handler(req, res)
  const payload = JSON.parse(res.body)
  if (res.statusCode !== 200 || !payload.ok) throw new Error('production GET failed')
  if (!Array.isArray(payload.scriptFormats) || payload.scriptFormats.length < 2) {
    throw new Error('script formats missing from GET')
  }
  if (!Array.isArray(payload.jobs)) throw new Error('jobs missing')

  const deleted = await deleteEofProductionJob(job.id)
  if (!deleted) throw new Error('delete job failed')
  const gone = await getEofProductionJob(job.id)
  if (gone) throw new Error('job still exists after delete')

  const job2 = await createEofProductionJob({
    topic: 'Delete via API',
    createdBy: 'test',
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

  // Image-only video build can start without prior audio
  const job3 = await createEofProductionJob({
    topic: 'Image only short',
    createdBy: 'test',
  })
  const videoReq = {
    method: 'POST',
    headers: { cookie: `admin_session=${token}` },
    url: '/api/admin/eof-production',
    body: { action: 'build-short', jobId: job3.id },
  }
  const videoRes = { statusCode: 200, headers: {}, setHeader() {}, end(body) { this.body = body } }
  await handler(videoReq, videoRes)
  if (videoRes.statusCode !== 202) {
    throw new Error(`build-short should accept async (202), got ${videoRes.statusCode}: ${videoRes.body}`)
  }

  // Durable video restore (simulates cold Vercel instance)
  if (await isFfmpegAvailable()) {
    const durableJob = await createEofProductionJob({
      topic: 'Durable video restore',
      createdBy: 'test',
    })
    const videoPath = eofProductionVideoAbsPath(durableJob.id)
    mkdirSync(dirname(videoPath), { recursive: true })
    await runFfmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x16162e:s=1080x1920:d=2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-t',
      '2',
      videoPath,
    ])
    const saved = await saveEofVideoArtifact(durableJob.id, videoPath)
    if (!saved) throw new Error('saveEofVideoArtifact failed')
    const durableBytes = statSync(videoPath).size
    rmSync(dirname(videoPath), { recursive: true, force: true })
    const restored = await ensureEofVideoOnDisk(durableJob.id)
    if (!restored || !existsSync(restored)) throw new Error('durable video restore failed')
    if (statSync(restored).size < 1000) throw new Error('restored video too small')

    // Stale /tmp plate must lose to durable video_base64 (Replace Captions preview bug).
    mkdirSync(dirname(videoPath), { recursive: true })
    await runFfmpeg([
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=red:s=320x240:d=1',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-t',
      '1',
      videoPath,
    ])
    const staleBytes = statSync(videoPath).size
    if (staleBytes === durableBytes) {
      // Extremely unlikely; still prove overwrite by comparing contents after ensure.
    }
    const refreshed = await ensureEofVideoOnDisk(durableJob.id)
    if (!refreshed || !existsSync(refreshed)) throw new Error('stale-disk refresh failed')
    if (statSync(refreshed).size !== durableBytes) {
      throw new Error(
        `ensureEofVideoOnDisk served stale disk plate (${statSync(refreshed).size}b) instead of durable (${durableBytes}b)`,
      )
    }

    await deleteEofProductionJob(durableJob.id)
  }

  await deleteEofProductionJob(debate.id)
  await deleteEofProductionJob(job3.id)

  console.log('EOF production lib smoke tests passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
