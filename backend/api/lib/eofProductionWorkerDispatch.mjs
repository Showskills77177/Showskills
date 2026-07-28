/**
 * Dispatch EOF video encode to an external worker (Railway / VPS).
 * Vercel keeps TTS + job API; the worker runs Serp + ffmpeg against the same DB.
 */

/** Absolute age ceiling when an external worker is doing the encode (not Vercel 300s). */
export const EOF_STALE_WORKER_MAX_AGE_SEC =
  Number(process.env.EOF_STALE_WORKER_MAX_AGE_SEC) || 900

/** Quiet window while a worker encode is running (heartbeats still protect under this). */
export const EOF_STALE_WORKER_QUIET_SEC =
  Number(process.env.EOF_STALE_WORKER_QUIET_SEC) || 240

/** @returns {string} worker origin, no trailing slash */
export function eofWorkerBaseUrl() {
  return String(process.env.EOF_WORKER_URL || '').trim().replace(/\/$/, '')
}

/** @returns {string} shared bearer secret */
export function eofWorkerSecret() {
  return String(process.env.EOF_WORKER_SECRET || '').trim()
}

/** True when staging/Vercel can hand video encodes to Railway (or another worker). */
export function isEofExternalWorkerConfigured() {
  return Boolean(eofWorkerBaseUrl() && eofWorkerSecret())
}

/**
 * POST /eof-worker/render on the worker — expects 202 quickly.
 * @param {string} jobId
 * @param {{ imageProvider?: string|null, forceFreshImages?: boolean, qualityGateMode?: 'auto'|'manual', mode?: 'build'|'caption-replace'|'effects-apply'|'stickers-apply'|'music-remix' }} [opts]
 */
export async function scheduleEofVideoOnWorker(jobId, opts = {}) {
  const origin = eofWorkerBaseUrl()
  const secret = eofWorkerSecret()
  if (!origin || !secret || !jobId) {
    console.warn('[eof-production] cannot schedule worker — need EOF_WORKER_URL + EOF_WORKER_SECRET', {
      hasOrigin: Boolean(origin),
      hasSecret: Boolean(secret),
      jobId,
    })
    return { ok: false, reason: 'missing_worker_url_or_secret' }
  }

  const url = `${origin}/eof-worker/render`
  const body = {
    jobId,
    step: 'video',
  }
  if (opts.imageProvider) body.imageProvider = opts.imageProvider
  if (opts.forceFreshImages === true) body.forceFreshImages = true
  if (opts.qualityGateMode === 'auto' || opts.qualityGateMode === 'manual') {
    body.qualityGateMode = opts.qualityGateMode
  }
  // Lightweight "keep images + voiceover" edits (Replace Captions / Apply Effects /
  // Apply Stickers / Remix Music) — else the worker defaults to a full build hop.
  if (
    opts.mode === 'caption-replace' ||
    opts.mode === 'effects-apply' ||
    opts.mode === 'stickers-apply' ||
    opts.mode === 'music-remix'
  ) {
    body.mode = opts.mode
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(Number(process.env.EOF_WORKER_FETCH_TIMEOUT_MS) || 20_000),
    })
    console.info('[eof-production] scheduled worker render', jobId, res.status)
    return { ok: res.ok || res.status === 202, status: res.status }
  } catch (e) {
    console.warn(
      '[eof-production] schedule worker failed',
      jobId,
      e instanceof Error ? e.message : e,
    )
    return { ok: false, reason: e instanceof Error ? e.message : String(e) }
  }
}
