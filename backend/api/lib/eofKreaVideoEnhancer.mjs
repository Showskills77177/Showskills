import { EofKreaVideoError, getEofKreaApiKey } from './eofKreaVideo.mjs'

const KREA_API_BASE = 'https://api.krea.ai'
const BLOB_HOST_SUFFIX = '.public.blob.vercel-storage.com'
const SOURCE_PREFIX = '/eof-video-enhancer/'
const JOB_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const EOF_KREA_VIDEO_ENHANCER_MODELS = {
  economy: {
    label: 'SeedVR 2',
    endpoint: '/generate/enhance/bytedance/seedvr-2',
    maxWidth: 3840,
    maxHeight: 2160,
  },
  quality: {
    label: 'Topaz Video Upscale',
    endpoint: '/generate/enhance/topaz/video-upscale',
    maxWidth: 8000,
    maxHeight: 8000,
  },
}

export function isEofKreaEnhancerJobId(value) {
  return typeof value === 'string' && JOB_ID_PATTERN.test(value)
}

export function isEofEnhancerBlobUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname.endsWith(BLOB_HOST_SUFFIX) &&
      url.pathname.startsWith(SOURCE_PREFIX) &&
      !url.pathname.includes('..')
    )
  } catch {
    return false
  }
}

export function buildEofKreaVideoEnhancerRequest({
  videoUrl,
  model = 'economy',
  target = '4k',
  noiseScale = 0.1,
}) {
  if (!isEofEnhancerBlobUrl(videoUrl)) {
    throw new EofKreaVideoError(
      'Upload a video to the EOF enhancer before starting an enhancement.',
      400,
      'INVALID_SOURCE_URL',
    )
  }
  const selected = EOF_KREA_VIDEO_ENHANCER_MODELS[model]
  if (!selected) {
    throw new EofKreaVideoError('Choose a supported enhancement model.', 400, 'INVALID_ENHANCER_MODEL')
  }

  if (model === 'economy') {
    const noise = Number(noiseScale)
    if (!Number.isFinite(noise) || noise < 0 || noise > 1) {
      throw new EofKreaVideoError('Denoising strength must be between 0 and 1.', 400, 'INVALID_NOISE_SCALE')
    }
    return {
      model: selected,
      body: { video_url: videoUrl, noise_scale: noise },
    }
  }

  const targetSize = target === '8k'
    ? { target_width: 7680, target_height: 4320 }
    : target === '4k'
      ? { target_width: 3840, target_height: 2160 }
      : null
  if (!targetSize) {
    throw new EofKreaVideoError('Choose 4K or 8K for Topaz output.', 400, 'INVALID_TARGET_SIZE')
  }
  return {
    model: selected,
    body: {
      video_url: videoUrl,
      ...targetSize,
      crop_to_fit: false,
      enhancement: true,
      enhancement_video_type: 'Progressive',
      enhancement_model: 'prob-4',
      enhancement_parameters: 'Auto',
      frame_interpolation: false,
      video_output_preset: 'h264-high',
    },
  }
}

async function requestKrea(path, { method = 'GET', body, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = getEofKreaApiKey()
  if (!apiKey) {
    throw new EofKreaVideoError(
      'Krea video enhancement is not configured. Set KREA_API_KEY in the Vercel server environment.',
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
  } catch {
    throw new EofKreaVideoError('Could not reach Krea. Check the connection and retry.', 502, 'KREA_UNAVAILABLE')
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new EofKreaVideoError('Krea rejected KREA_API_KEY. Check the Vercel environment variable.', 502, 'KREA_KEY_REJECTED')
    }
    if (response.status === 402) {
      throw new EofKreaVideoError('Krea has no available credits for this request. Check workspace billing.', 402, 'KREA_CREDITS_EXHAUSTED')
    }
    if (response.status === 429) {
      throw new EofKreaVideoError('Krea is rate-limiting or at its concurrent-job limit. Wait and retry.', 429, 'KREA_RATE_LIMITED')
    }
    throw new EofKreaVideoError(`Krea API returned HTTP ${response.status}. Please retry.`, 502, 'KREA_API_ERROR')
  }

  try {
    return await response.json()
  } catch {
    throw new EofKreaVideoError('Krea returned an unreadable response. Please retry.', 502, 'KREA_INVALID_RESPONSE')
  }
}

export function createEofKreaVideoEnhancerJob(request) {
  return requestKrea(request.model.endpoint, { method: 'POST', body: request.body })
}

export function getEofKreaVideoEnhancerJob(jobId) {
  if (!isEofKreaEnhancerJobId(jobId)) {
    throw new EofKreaVideoError('A valid Krea jobId is required.', 400, 'INVALID_JOB_ID')
  }
  return requestKrea(`/jobs/${encodeURIComponent(jobId)}`)
}

