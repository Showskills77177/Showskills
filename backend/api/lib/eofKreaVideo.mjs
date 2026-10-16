export const EOF_KREA_VIDEO_ENDPOINT = '/generate/video/bytedance/seedance-1.0-pro-fast'
export const EOF_KREA_VIDEO_MAX_PROMPT_LENGTH = 2000
export const EOF_KREA_VIDEO_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21']
export const EOF_KREA_VIDEO_RESOLUTIONS = ['480p', '720p', '1080p']

const KREA_API_BASE = 'https://api.krea.ai'
const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class EofKreaVideoError extends Error {
  constructor(message, statusCode = 502, code = 'KREA_API_ERROR') {
    super(message)
    this.name = 'EofKreaVideoError'
    this.statusCode = statusCode
    this.code = code
  }
}

export function getEofKreaApiKey() {
  return String(process.env.KREA_API_KEY || '').trim()
}

export function isEofKreaJobId(value) {
  return typeof value === 'string' && JOB_ID_PATTERN.test(value)
}

function errorForStatus(status) {
  if (status === 401) {
    return new EofKreaVideoError('Krea rejected KREA_API_KEY. Check the Vercel staging environment variable.', 502, 'KREA_KEY_REJECTED')
  }
  if (status === 402) {
    return new EofKreaVideoError('Krea has no available credits for this request. Check the Krea workspace billing.', 402, 'KREA_CREDITS_EXHAUSTED')
  }
  if (status === 429) {
    return new EofKreaVideoError('Krea is rate-limiting or at its concurrent-job limit. Wait and retry.', 429, 'KREA_RATE_LIMITED')
  }
  return new EofKreaVideoError(`Krea API returned HTTP ${status}. Please retry.`, 502, 'KREA_API_ERROR')
}

async function requestKrea(path, { method = 'GET', body, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = getEofKreaApiKey()
  if (!apiKey) {
    throw new EofKreaVideoError(
      'Krea video is not configured. Set KREA_API_KEY in the Vercel staging server environment.',
      503,
      'KREA_NOT_CONFIGURED',
    )
  }

  let response
  try {
    response = await fetchImpl(`${KREA_API_BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new EofKreaVideoError('Krea did not respond in time. Please retry.', 504, 'KREA_TIMEOUT')
    }
    throw new EofKreaVideoError('Could not reach Krea. Check the connection and retry.', 502, 'KREA_UNAVAILABLE')
  }

  if (!response.ok) throw errorForStatus(response.status)

  try {
    return await response.json()
  } catch {
    throw new EofKreaVideoError('Krea returned an unreadable response. Please retry.', 502, 'KREA_INVALID_RESPONSE')
  }
}

export function buildEofKreaVideoRequest({ prompt, duration, aspectRatio, resolution }) {
  const exactPrompt = typeof prompt === 'string' ? prompt : ''
  if (!exactPrompt.trim()) {
    throw new EofKreaVideoError('Enter a video prompt.', 400, 'INVALID_PROMPT')
  }
  if (exactPrompt.length > EOF_KREA_VIDEO_MAX_PROMPT_LENGTH) {
    throw new EofKreaVideoError(
      `Prompt must be ${EOF_KREA_VIDEO_MAX_PROMPT_LENGTH} characters or fewer.`,
      400,
      'PROMPT_TOO_LONG',
    )
  }

  const seconds = Number(duration)
  if (!Number.isFinite(seconds) || seconds < 2 || seconds > 12) {
    throw new EofKreaVideoError('Duration must be between 2 and 12 seconds.', 400, 'INVALID_DURATION')
  }
  if (!EOF_KREA_VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
    throw new EofKreaVideoError('Choose a supported aspect ratio.', 400, 'INVALID_ASPECT_RATIO')
  }
  if (!EOF_KREA_VIDEO_RESOLUTIONS.includes(resolution)) {
    throw new EofKreaVideoError('Choose a supported resolution.', 400, 'INVALID_RESOLUTION')
  }

  return { prompt: exactPrompt, duration: seconds, aspect_ratio: aspectRatio, resolution }
}

export function normalizeEofKreaVideoJob(job) {
  const status = typeof job?.status === 'string' ? job.status : 'unknown'
  const progress = typeof job?.progress === 'number' ? job.progress : Number.NaN
  const resultError = job?.result?.error
  const error = job?.error || resultError
  return {
    jobId: typeof job?.job_id === 'string' ? job.job_id : '',
    status,
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : null,
    error:
      typeof error?.message === 'string'
        ? error.message.slice(0, 400)
        : typeof error === 'string'
          ? error.slice(0, 400)
          : '',
    hasVideo: status === 'completed' && Boolean(extractEofKreaVideoUrl(job)),
  }
}

export function extractEofKreaVideoUrl(job) {
  const urls = job?.result?.urls
  const candidates = Array.isArray(urls)
    ? urls
    : urls && typeof urls === 'object'
      ? Object.values(urls)
      : []

  const preferredCandidates = [...candidates].sort((a, b) => {
    const aModel = typeof a === 'object' && a?.type === 'model'
    const bModel = typeof b === 'object' && b?.type === 'model'
    return Number(bModel) - Number(aModel)
  })

  for (const candidate of preferredCandidates) {
    const value = typeof candidate === 'string' ? candidate : candidate?.url
    if (typeof value !== 'string') continue
    try {
      const parsed = new URL(value)
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href
    } catch {
      // Ignore malformed result URLs; only Krea-returned HTTPS media URLs are streamed.
    }
  }
  return null
}

export function createEofKreaVideoJob(request) {
  return requestKrea(EOF_KREA_VIDEO_ENDPOINT, { method: 'POST', body: request })
}

export function getEofKreaVideoJob(jobId) {
  return requestKrea(`/jobs/${encodeURIComponent(jobId)}`)
}
