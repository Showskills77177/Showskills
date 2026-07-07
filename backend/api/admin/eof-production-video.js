import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import { getEofProductionJob } from '../lib/eofProductionJobs.mjs'
import { eofProductionVideoAbsPath } from '../lib/eofProductionVideo.mjs'

/** Stream rendered Short MP4 for a production job. */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Eyes Of Football production is only available on staging.' }))
    return
  }

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET, OPTIONS')
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  try {
    await requireEofSession(req)
  } catch (e) {
    res.statusCode = e.statusCode || 401
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Unauthorized' }))
    return
  }

  let jobId = ''
  try {
    const raw = typeof req.url === 'string' ? req.url : '/'
    const url = new URL(raw, 'http://localhost')
    jobId = (url.searchParams.get('jobId') || '').trim()
  } catch {
    jobId = ''
  }

  if (!jobId) {
    res.statusCode = 400
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'jobId is required.' }))
    return
  }

  const job = await getEofProductionJob(jobId)
  if (!job) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Job not found.' }))
    return
  }

  const videoPath = eofProductionVideoAbsPath(jobId)
  if (!existsSync(videoPath)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'Video file is not on this server instance. Re-run “Render video” to preview again.',
      }),
    )
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'video/mp4')
  res.setHeader('Cache-Control', 'private, no-store')
  createReadStream(videoPath).pipe(res)
}
