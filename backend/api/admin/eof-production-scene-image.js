import { createReadStream, existsSync, readFileSync } from 'node:fs'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import { getEofProductionJob } from '../lib/eofProductionJobs.mjs'
import { ensureEofSceneImageOnDisk } from '../lib/eofProductionArtifacts.mjs'
import { fetchEofSceneImage, eofSceneImageAbsPath } from '../lib/eofSceneImages.mjs'
import { eofProductionWorkDir } from '../lib/eofSceneTts.mjs'
import { buildEofShortThumbnailForJob } from '../lib/eofShortThumbnail.mjs'

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

/**
 * Stream a scene still, or an adapted YouTube Shorts thumbnail (1280×720).
 *
 * GET ?jobId=&scene=1
 * GET ?jobId=&thumbnail=1[&scene=][&format=base64]
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.status(204).end()
  }

  if (!isShowSkillsStagingServerEnabled()) {
    return sendJson(res, 404, { error: 'Eyes Of Football production is only available on staging.' })
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return sendJson(res, 405, { error: 'Method not allowed' })
  }

  try {
    await requireEofSession(req)
  } catch (e) {
    return sendJson(res, e.statusCode || 401, { error: 'Unauthorized' })
  }

  let jobId = ''
  let scene = 1
  let asThumbnail = false
  let asBase64 = false
  try {
    const raw = typeof req.url === 'string' ? req.url : '/'
    const url = new URL(raw, 'http://localhost')
    jobId = (url.searchParams.get('jobId') || '').trim()
    scene = Math.max(1, Number.parseInt(url.searchParams.get('scene') || '1', 10) || 1)
    asThumbnail =
      url.searchParams.get('thumbnail') === '1' ||
      url.searchParams.get('adapted') === '1' ||
      url.searchParams.get('kind') === 'thumbnail'
    asBase64 = url.searchParams.get('format') === 'base64' || url.searchParams.get('base64') === '1'
  } catch {
    jobId = ''
  }

  if (!jobId) return sendJson(res, 400, { error: 'jobId is required.' })

  const job = await getEofProductionJob(jobId)
  if (!job) return sendJson(res, 404, { error: 'Job not found.' })

  if (asThumbnail) {
    try {
      const thumb = await buildEofShortThumbnailForJob(jobId, {
        sceneIndex: Number.isFinite(scene) && scene > 0 ? scene - 1 : undefined,
        refreshMeta: true,
      })
      if (asBase64) {
        return sendJson(res, 200, {
          ok: true,
          mime: thumb.mime,
          sceneIndex: thumb.sceneIndex,
          bytes: thumb.bytes,
          thumbnailBase64: thumb.base64,
        })
      }
      res.statusCode = 200
      res.setHeader('Content-Type', 'image/jpeg')
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-EOF-Thumb-Scene', String(thumb.sceneIndex))
      createReadStream(thumb.path).pipe(res)
      return
    } catch (e) {
      console.error('[eof-thumbnail]', e)
      return sendJson(res, 400, { error: e instanceof Error ? e.message : 'Could not build thumbnail' })
    }
  }

  let imagePath = await ensureEofSceneImageOnDisk(jobId, scene)

  // Last resort: re-fetch from image providers using saved query metadata
  if (!imagePath || !existsSync(imagePath)) {
    const manifest = Array.isArray(job.narrationManifest) ? job.narrationManifest : []
    const entry = manifest.find((row) => Number(row.index) === scene - 1) || manifest[scene - 1]
    const imageQuery = entry?.imageQueryUsed || entry?.imageQuery || job.script?.scenes?.[scene - 1]?.imageQuery
    if (imageQuery) {
      try {
        const outPath = eofSceneImageAbsPath(eofProductionWorkDir(jobId), scene)
        await fetchEofSceneImage({
          topic: job.topic,
          imageQuery,
          outPath,
          index: scene - 1,
          refresh: true,
        })
        if (existsSync(outPath)) imagePath = outPath
      } catch (e) {
        console.warn('[eof-scene-image] lazy re-fetch failed', jobId, scene, e)
      }
    }
  }

  if (!imagePath || !existsSync(imagePath)) {
    return sendJson(res, 404, { error: 'Scene image not available — re-run Build Short.' })
  }

  if (asBase64) {
    const buf = readFileSync(imagePath)
    return sendJson(res, 200, {
      ok: true,
      mime: 'image/jpeg',
      sceneIndex: scene - 1,
      bytes: buf.length,
      thumbnailBase64: buf.toString('base64'),
    })
  }

  res.statusCode = 200
  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Cache-Control', 'private, no-store')
  createReadStream(imagePath).pipe(res)
}
