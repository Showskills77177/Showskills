import { createReadStream, existsSync } from 'node:fs'
import { join } from 'node:path'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import { getEofProductionJob } from '../lib/eofProductionJobs.mjs'
import { eofProductionWorkDir } from '../lib/eofSceneTts.mjs'
import { eofSceneImageAbsPath } from '../lib/eofSceneImages.mjs'

/** Stream a scene still used in the rendered Short. */
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
  let scene = 1
  try {
    const raw = typeof req.url === 'string' ? req.url : '/'
    const url = new URL(raw, 'http://localhost')
    jobId = (url.searchParams.get('jobId') || '').trim()
    scene = Math.max(1, Number.parseInt(url.searchParams.get('scene') || '1', 10) || 1)
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

  const imagePath = eofSceneImageAbsPath(eofProductionWorkDir(jobId), scene)
  if (!existsSync(imagePath)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Scene image not on this server — re-run Build Short.' }))
    return
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'private, no-store')
  createReadStream(imagePath).pipe(res)
}
