import { Readable } from 'node:stream'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { json, readJsonBody } from '../lib/http.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import { selectEofKreaVideoModel } from '../lib/eofKreaVideoSelection.mjs'
import {
  buildEofKreaVideoRequest,
  createEofKreaVideoJob,
  EofKreaVideoError,
  extractEofKreaVideoUrl,
  getEofKreaApiKey,
  getEofKreaVideoJob,
  isEofKreaJobId,
  normalizeEofKreaVideoJob,
} from '../lib/eofKreaVideo.mjs'

function searchParamsFromReq(req) {
  try {
    return new URL(req.originalUrl || req.url || '/', 'http://local').searchParams
  } catch {
    return new URLSearchParams()
  }
}

function handleError(res, error) {
  if (error instanceof EofKreaVideoError) {
    return json(res, error.statusCode, { error: error.message, code: error.code })
  }
  if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 600) {
    return json(res, error.statusCode, {
      error: error.message || 'The Krea model selection failed. Please retry.',
      code: error.code || 'KREA_REQUEST_FAILED',
    })
  }
  return json(res, 502, { error: 'The Krea request failed. Please retry.', code: 'KREA_REQUEST_FAILED' })
}

function normalizeJob(job) {
  const normalized = normalizeEofKreaVideoJob(job)
  if (!isEofKreaJobId(normalized.jobId) || normalized.status === 'unknown') {
    throw new EofKreaVideoError('Krea returned an invalid job response. Please retry.', 502, 'KREA_INVALID_RESPONSE')
  }
  return normalized
}

async function streamVideo(res, jobId, download) {
  const job = await getEofKreaVideoJob(jobId)
  if (job.status !== 'completed') {
    return json(res, 409, {
      error: job.status === 'failed' ? 'Krea could not generate this video.' : 'This video is not ready yet.',
      status: job.status,
    })
  }

  const videoUrl = extractEofKreaVideoUrl(job)
  if (!videoUrl) return json(res, 502, { error: 'Krea completed the job without a usable video URL.' })

  let upstream
  try {
    upstream = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) })
  } catch {
    return json(res, 502, { error: 'Could not retrieve the generated video from Krea. Please retry.' })
  }
  if (!upstream.ok || !upstream.body) {
    return json(res, 502, { error: 'Krea could not provide the generated video. Please retry.' })
  }

  const contentType = upstream.headers.get('content-type') || ''
  const mediaType = contentType.split(';', 1)[0].trim().toLowerCase()
  if (mediaType && !mediaType.startsWith('video/') && mediaType !== 'application/octet-stream') {
    return json(res, 502, { error: 'Krea returned an unsupported video format.' })
  }

  res.statusCode = 200
  res.setHeader('Content-Type', mediaType || 'video/mp4')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (download) {
    res.setHeader('Content-Disposition', `attachment; filename="krea-${jobId}.mp4"`)
  }
  const contentLength = upstream.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength)) res.setHeader('Content-Length', contentLength)

  const mediaStream = Readable.fromWeb(upstream.body)
  mediaStream.on('error', () => {
    if (res.headersSent) res.destroy()
    else json(res, 502, { error: 'The generated video stream was interrupted.' })
  })
  mediaStream.pipe(res)
}

export default async function handler(req, res) {
  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Krea video generation is only available on staging.' })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return json(res, 405, { error: 'Method not allowed' })
  }

  try {
    await requireEofSession(req)
  } catch (error) {
    return json(res, error.statusCode || 401, { error: 'Unauthorized' })
  }

  if (!getEofKreaApiKey()) {
    return json(res, 503, {
      error: 'Krea video is not configured. Set KREA_API_KEY in the Vercel staging server environment.',
      code: 'KREA_NOT_CONFIGURED',
    })
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const selection = await selectEofKreaVideoModel(body)
      const request = buildEofKreaVideoRequest({
        ...body,
        duration: selection.durationSeconds,
        modelId: selection.modelId,
      })
      const job = await createEofKreaVideoJob(request)
      return json(res, 200, { job: normalizeJob(job), selection })
    } catch (error) {
      return handleError(res, error)
    }
  }

  const params = searchParamsFromReq(req)
  const jobId = params.get('jobId') || ''
  const action = params.get('action') || 'status'
  if (!isEofKreaJobId(jobId)) {
    return json(res, 400, { error: 'A valid Krea jobId is required.' })
  }

  try {
    if (action === 'status') {
      const job = await getEofKreaVideoJob(jobId)
      return json(res, 200, { job: normalizeJob(job) })
    }
    if (action === 'preview' || action === 'download') {
      return await streamVideo(res, jobId, action === 'download')
    }
    return json(res, 400, { error: 'Choose status, preview, or download.' })
  } catch (error) {
    return handleError(res, error)
  }
}
