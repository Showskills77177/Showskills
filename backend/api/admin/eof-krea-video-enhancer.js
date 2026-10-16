import { del } from '@vercel/blob'
import { handleUpload } from '@vercel/blob/client'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { Readable } from 'node:stream'
import { isShowSkillsStagingServerEnabled } from '../../../shared/stagingSite.mjs'
import { json, readJsonBody } from '../lib/http.mjs'
import { requireEofSession } from '../lib/eofYoutubeAuth.mjs'
import {
  buildEofKreaVideoEnhancerRequest,
  createEofKreaVideoEnhancerJob,
  getEofKreaVideoEnhancerJob,
  isEofEnhancerBlobUrl,
  isEofKreaEnhancerJobId,
} from '../lib/eofKreaVideoEnhancer.mjs'
import {
  EofKreaVideoError,
  extractEofKreaVideoUrl,
  getEofKreaApiKey,
  normalizeEofKreaVideoJob,
} from '../lib/eofKreaVideo.mjs'

const MAX_BLOB_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024 * 1024
const DEFAULT_UPLOAD_LIMIT_BYTES = 1024 * 1024 * 1024

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
      error: error.message || 'The video enhancer request failed. Please retry.',
      code: error.code || 'VIDEO_ENHANCER_REQUEST_FAILED',
    })
  }
  return json(res, 502, { error: 'The video enhancer request failed. Please retry.' })
}

function configuredUploadLimit() {
  if (!process.env.EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES) return DEFAULT_UPLOAD_LIMIT_BYTES
  const configured = Number(process.env.EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES)
  if (
    !Number.isSafeInteger(configured) ||
    configured < 1 ||
    configured > MAX_BLOB_UPLOAD_BYTES
  ) {
    return null
  }
  return configured
}

function signUploadClaim(userId, uploadId, expiresAt) {
  const secret = String(process.env.ADMIN_JWT_SECRET || '').trim()
  if (!secret) throw new EofKreaVideoError('Admin session signing is not configured.', 503, 'ADMIN_AUTH_NOT_CONFIGURED')
  const payload = Buffer.from(JSON.stringify({ userId, uploadId, expiresAt })).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifyUploadClaim(value, userId) {
  if (typeof value !== 'string' || value.length > 1024 || !userId) return null
  const [payload, signature, extra] = value.split('.')
  if (!payload || !signature || extra) return null
  const secret = String(process.env.ADMIN_JWT_SECRET || '').trim()
  if (!secret) return null
  const expected = createHmac('sha256', secret).update(payload).digest()
  let supplied
  try {
    supplied = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (
      claim.userId !== userId ||
      !/^[0-9a-f-]{36}$/i.test(claim.uploadId) ||
      !Number.isInteger(claim.expiresAt) ||
      claim.expiresAt <= Date.now()
    ) return null
    return claim
  } catch {
    return null
  }
}

function normalizeJob(job) {
  const normalized = normalizeEofKreaVideoJob(job)
  if (!isEofKreaEnhancerJobId(normalized.jobId) || normalized.status === 'unknown') {
    throw new EofKreaVideoError('Krea returned an invalid job response. Please retry.', 502, 'KREA_INVALID_RESPONSE')
  }
  return normalized
}

async function streamVideo(res, jobId, download) {
  const job = await getEofKreaVideoEnhancerJob(jobId)
  if (job.status !== 'completed') {
    return json(res, 409, {
      error: job.status === 'failed' ? 'Krea could not enhance this video.' : 'This video is not ready yet.',
      status: job.status,
    })
  }
  const videoUrl = extractEofKreaVideoUrl(job)
  if (!videoUrl) return json(res, 502, { error: 'Krea completed the job without a usable video URL.' })

  let upstream
  try {
    upstream = await fetch(videoUrl, { signal: AbortSignal.timeout(120_000) })
  } catch {
    return json(res, 502, { error: 'Could not retrieve the enhanced video from Krea. Please retry.' })
  }
  if (!upstream.ok || !upstream.body) {
    return json(res, 502, { error: 'Krea could not provide the enhanced video.' })
  }
  const mediaType = (upstream.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase()
  if (mediaType && !mediaType.startsWith('video/') && mediaType !== 'application/octet-stream') {
    return json(res, 502, { error: 'Krea returned an unsupported video format.' })
  }

  res.statusCode = 200
  res.setHeader('Content-Type', mediaType || 'video/mp4')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (download) res.setHeader('Content-Disposition', `attachment; filename="eof-enhanced-${jobId}.mp4"`)
  const contentLength = upstream.headers.get('content-length')
  if (contentLength && /^\d+$/.test(contentLength)) res.setHeader('Content-Length', contentLength)
  const mediaStream = Readable.fromWeb(upstream.body)
  mediaStream.on('error', () => {
    if (res.headersSent) res.destroy()
    else json(res, 502, { error: 'The enhanced video stream was interrupted.' })
  })
  mediaStream.pipe(res)
}

async function uploadToken(req, res, body, session) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return json(res, 503, {
      error: 'Video staging is not configured. Add BLOB_READ_WRITE_TOKEN to the Vercel server environment.',
      code: 'BLOB_NOT_CONFIGURED',
    })
  }
  const maximumSizeInBytes = configuredUploadLimit()
  if (!maximumSizeInBytes) {
    return json(res, 503, {
      error: 'Video upload limit is not configured. Set EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES within your Blob/account quota.',
      code: 'UPLOAD_LIMIT_NOT_CONFIGURED',
    })
  }
  const result = await handleUpload({
    body,
    request: req,
    onBeforeGenerateToken: async (pathname, clientPayload) => {
      const claim = verifyUploadClaim(clientPayload, session.sub)
      if (
        !claim ||
        pathname !== `eof-video-enhancer/source-${claim.uploadId}.${String(pathname).split('.').pop()}` ||
        !/^eof-video-enhancer\/source-[0-9a-f-]{36}\.[A-Za-z0-9]{1,8}$/i.test(pathname)
      ) {
        throw new EofKreaVideoError('Invalid upload filename.', 400, 'INVALID_UPLOAD_PATH')
      }
      return {
        allowedContentTypes: ['video/*', 'application/octet-stream'],
        maximumSizeInBytes,
        addRandomSuffix: false,
        allowOverwrite: false,
        tokenPayload: clientPayload,
      }
    },
  })
  return json(res, 200, result)
}

async function cleanupSource(sourceUrl, cleanupToken, userId) {
  if (!isEofEnhancerBlobUrl(sourceUrl)) {
    throw new EofKreaVideoError('Invalid staged source URL.', 400, 'INVALID_SOURCE_URL')
  }
  const claim = verifyUploadClaim(cleanupToken, userId)
  let url
  try {
    url = new URL(sourceUrl)
  } catch {
    throw new EofKreaVideoError('Invalid staged source URL.', 400, 'INVALID_SOURCE_URL')
  }
  if (!claim || url.pathname !== `/eof-video-enhancer/source-${claim.uploadId}.${url.pathname.split('.').pop()}`) {
    throw new EofKreaVideoError('You cannot remove this staged video.', 403, 'SOURCE_OWNERSHIP_REQUIRED')
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new EofKreaVideoError('Vercel Blob is not configured.', 503, 'BLOB_NOT_CONFIGURED')
  }
  await del(sourceUrl)
}

export default async function handler(req, res) {
  if (!isShowSkillsStagingServerEnabled()) {
    return json(res, 404, { error: 'Krea video enhancement is only available on staging.' })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return json(res, 405, { error: 'Method not allowed' })
  }
  let session
  try {
    session = await requireEofSession(req)
  } catch (error) {
    return json(res, error.statusCode || 401, { error: 'Unauthorized' })
  }

  if (req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      if (body.action === 'upload-config') {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          return json(res, 503, {
            error: 'Video staging is not configured. Add BLOB_READ_WRITE_TOKEN to the Vercel server environment.',
            code: 'BLOB_NOT_CONFIGURED',
          })
        }
        const maxUploadBytes = configuredUploadLimit()
        if (!maxUploadBytes) {
          return json(res, 503, {
            error: 'Video upload limit is not configured. Set EOF_KREA_ENHANCER_MAX_UPLOAD_BYTES to a positive byte limit no greater than 5497558138880, within your Blob/account quota.',
            code: 'UPLOAD_LIMIT_NOT_CONFIGURED',
          })
        }
        const uploadId = randomUUID()
        const cleanupToken = signUploadClaim(session.sub, uploadId, Date.now() + 7 * 24 * 60 * 60 * 1000)
        return json(res, 200, { maxUploadBytes, uploadId, cleanupToken })
      }
      if (body.action === 'upload-token' || body.type === 'blob.generate-client-token') {
        return await uploadToken(req, res, body, session)
      }
      if (body.action === 'cleanup-source') {
        await cleanupSource(body.sourceUrl, body.cleanupToken, session.sub)
        return json(res, 200, { ok: true })
      }
      if (body.action !== 'enhance') {
        return json(res, 400, { error: 'Choose upload-token or enhance.' })
      }
      if (!getEofKreaApiKey()) {
        return json(res, 503, {
          error: 'Krea video enhancement is not configured. Set KREA_API_KEY in the Vercel server environment.',
          code: 'KREA_NOT_CONFIGURED',
        })
      }
      const request = buildEofKreaVideoEnhancerRequest(body)
      const job = await createEofKreaVideoEnhancerJob(request)
      return json(res, 200, {
        job: normalizeJob(job),
        model: request.model.label,
        note: 'Krea model pricing is not published in the API docs; compare the displayed provider estimate before confirming in Krea.',
      })
    } catch (error) {
      return handleError(res, error)
    }
  }

  const params = searchParamsFromReq(req)
  const jobId = params.get('jobId') || ''
  const action = params.get('action') || 'status'
  if (!isEofKreaEnhancerJobId(jobId)) {
    return json(res, 400, { error: 'A valid Krea enhancement jobId is required.' })
  }
  try {
    if (action === 'status') {
      const job = await getEofKreaVideoEnhancerJob(jobId)
      const normalized = normalizeJob(job)
      if (normalized.status === 'completed') {
        await cleanupSource(params.get('sourceUrl') || '')
      }
      return json(res, 200, { job: normalized })
    }
    if (action === 'preview' || action === 'download') {
      return await streamVideo(res, jobId, action === 'download')
    }
    return json(res, 400, { error: 'Choose status, preview, or download.' })
  } catch (error) {
    return handleError(res, error)
  }
}
