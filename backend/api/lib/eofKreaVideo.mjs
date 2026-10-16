export const EOF_KREA_VIDEO_MAX_PROMPT_LENGTH = 5000
export const EOF_KREA_VIDEO_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4']
export const EOF_KREA_VIDEO_RESOLUTIONS = ['480p', '720p', '1080p']
export const EOF_KREA_VIDEO_MODELS = {
  'seedance-fast': {
    label: 'Seedance 1.0 Pro Fast',
    endpoint: '/generate/video/bytedance/seedance-1.0-pro-fast',
    minDuration: 2,
    maxDuration: 12,
    supportsReferences: false,
  },
  'seedance-mini': {
    label: 'Seedance 2.0 Mini',
    endpoint: '/generate/video/bytedance/seedance-2-mini',
    minDuration: 4,
    maxDuration: 15,
    supportsReferences: true,
  },
  'wan-3': {
    label: 'Wan 3.0',
    endpoint: '/generate/video/alibaba/wan-3.0',
    minDuration: 2,
    maxDuration: 30,
    supportsReferences: true,
  },
}

const KREA_API_BASE = 'https://api.krea.ai'
const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MODEL_IDS = Object.keys(EOF_KREA_VIDEO_MODELS)

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

export function buildEofKreaVideoRequest({ prompt, duration, aspectRatio, resolution, modelId }) {
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

  const model = EOF_KREA_VIDEO_MODELS[modelId]
  if (!model) {
    throw new EofKreaVideoError('The AI selected an unsupported Krea video model. Retry your prompt.', 502, 'INVALID_MODEL_SELECTION')
  }
  const seconds = Number(duration)
  if (!Number.isInteger(seconds) || seconds < model.minDuration || seconds > model.maxDuration) {
    throw new EofKreaVideoError(
      `${model.label} supports individual clips from ${model.minDuration} to ${model.maxDuration} seconds. Krea does not offer unlimited-length single jobs.`,
      400,
      'DURATION_OUT_OF_RANGE',
    )
  }
  if (!EOF_KREA_VIDEO_ASPECT_RATIOS.includes(aspectRatio)) {
    throw new EofKreaVideoError('Choose a supported aspect ratio.', 400, 'INVALID_ASPECT_RATIO')
  }
  if (!EOF_KREA_VIDEO_RESOLUTIONS.includes(resolution)) {
    throw new EofKreaVideoError('Choose a supported resolution.', 400, 'INVALID_RESOLUTION')
  }

  return {
    modelId,
    model,
    body: { prompt: exactPrompt, duration: seconds, aspect_ratio: aspectRatio, resolution },
  }
}

export function isEofKreaVideoModelId(value) {
  return MODEL_IDS.includes(value)
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
  return requestKrea(request.model.endpoint, { method: 'POST', body: request.body })
}

export function getEofKreaVideoJob(jobId) {
  return requestKrea(`/jobs/${encodeURIComponent(jobId)}`)
}
