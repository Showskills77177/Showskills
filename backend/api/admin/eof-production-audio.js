import { createReadStream, existsSync } from 'node:fs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import { getEofProductionJob } from '../lib/eofProductionJobs.mjs'
import { ensureEofMixedAudioOnDisk } from '../lib/eofProductionArtifacts.mjs'

/** Stream rendered mixed MP3 for a production job. */
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

  const audioPath = await ensureEofMixedAudioOnDisk(jobId)
  if (!audioPath || !existsSync(audioPath)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error:
          'Mixed audio is not available. Re-run “Render audio + music” or Build Short to generate it again.',
      }),
    )
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Cache-Control', 'private, no-store')
  createReadStream(audioPath).pipe(res)
}
