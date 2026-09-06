#!/usr/bin/env node
/**
 * EOF Short video worker for Railway (or any long-running host).
 *
 * Vercel does TTS / admin API. This process runs Serp + ffmpeg and writes
 * video_base64 back to the same Postgres as staging.
 *
 * Env (required):
 *   DATABASE_URL or POSTGRES_URL
 *   EOF_WORKER_SECRET
 * Optional:
 *   PORT (Railway sets this)
 *   SERPAPI_API_KEY / image provider keys
 *   FFMPEG_PATH (else ffmpeg-static or PATH)
 *
 * Do NOT set VERCEL / VERCEL_ENV here — full encode profile must stay on.
 */
import express from 'express'
import {
  continueEofProductionBuild,
  renderEofProductionCaptionReplace,
  renderEofProductionEffectsApply,
  renderEofProductionStickersApply,
  renderEofProductionMusicRemix,
  renderEofProductionVoiceoverOnly,
  applyEofProductionZapcapCaptions,
} from '../backend/api/lib/eofProductionRenderRunner.mjs'
import {
  getEofProductionJob,
  markEofProductionJobFailed,
} from '../backend/api/lib/eofProductionJobs.mjs'
import { EOF_PRODUCTION_JOB_STATUS } from '../shared/eofProduction.mjs'
import {
  isYtDlpAvailable,
  isYtDlpCookiesConfigured,
} from '../backend/api/lib/eofYtDlp.mjs'
import { isXaiConfigured } from '../backend/api/lib/eofXaiClient.mjs'

const PORT = Number(process.env.PORT) || 8080
const SECRET = String(process.env.EOF_WORKER_SECRET || '').trim()

/** @type {Set<string>} */
const activeJobs = new Set()

function bearerOk(req) {
  const header = String(req.headers.authorization || '')
  const m = /^Bearer\s+(.+)$/i.exec(header)
  const token = (m?.[1] || '').trim()
  return Boolean(SECRET && token && token === SECRET)
}

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'eof-railway-worker',
    activeJobs: activeJobs.size,
    ffmpegBudget: 'non-vercel-full',
    ytDlpCookiesConfigured: isYtDlpCookiesConfigured(),
    visionMatchingConfigured: isXaiConfigured(),
  })
})

app.get('/', (_req, res) => {
  res.status(200).json({ ok: true, service: 'eof-railway-worker' })
})

app.post('/eof-worker/render', async (req, res) => {
  if (!SECRET) {
    res.status(503).json({ ok: false, error: 'EOF_WORKER_SECRET is not set on the worker' })
    return
  }
  if (!bearerOk(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' })
    return
  }

  const jobId = String(req.body?.jobId || '').trim()
  if (!jobId) {
    res.status(400).json({ ok: false, error: 'jobId required' })
    return
  }

  let job
  try {
    job = await getEofProductionJob(jobId)
  } catch (e) {
    console.error('[eof-worker] load job failed', jobId, e)
    res.status(500).json({ ok: false, error: 'Failed to load job' })
    return
  }

  if (!job) {
    res.status(404).json({ ok: false, error: 'Job not found' })
    return
  }

  const status = String(job.status || '')
  if (
    status !== EOF_PRODUCTION_JOB_STATUS.RENDERING &&
    status !== EOF_PRODUCTION_JOB_STATUS.RENDERING_VIDEO &&
    status !== EOF_PRODUCTION_JOB_STATUS.RENDERED
  ) {
    res.status(409).json({
      ok: false,
      error: `Job status ${status} is not ready for video encode`,
      status,
    })
    return
  }

  if (activeJobs.has(jobId)) {
    res.status(202).json({ ok: true, accepted: true, jobId, duplicate: true })
    return
  }

  activeJobs.add(jobId)
  res.status(202).json({ ok: true, accepted: true, jobId })

  const imageProvider = req.body?.imageProvider || null
  const forceFreshImages = req.body?.forceFreshImages === true
  const qualityGateMode = req.body?.qualityGateMode === 'auto' ? 'auto' : 'manual'
  const mode = String(req.body?.mode || '').trim()

  void (async () => {
    try {
      console.info('[eof-worker] starting video encode', jobId, mode ? `mode=${mode}` : '')
      if (mode === 'caption-replace') {
        await renderEofProductionCaptionReplace(jobId)
      } else if (mode === 'effects-apply') {
        await renderEofProductionEffectsApply(jobId)
      } else if (mode === 'stickers-apply') {
        await renderEofProductionStickersApply(jobId)
      } else if (mode === 'music-remix') {
        await renderEofProductionMusicRemix(jobId)
      } else if (mode === 'voiceover-regen') {
        await renderEofProductionVoiceoverOnly(jobId)
      } else if (mode === 'zapcap-apply') {
        await applyEofProductionZapcapCaptions(jobId)
      } else {
        await continueEofProductionBuild(jobId, {
          step: 'video',
          imageProvider,
          forceFreshImages,
          qualityGateMode,
        })
      }
      console.info('[eof-worker] finished', jobId)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Worker encode failed'
      console.error('[eof-worker] encode failed', jobId, message)
      await markEofProductionJobFailed(jobId, message, { onlyWhenRendering: true }).catch(() => {})
    } finally {
      activeJobs.delete(jobId)
    }
  })()
})

app.listen(PORT, '0.0.0.0', () => {
  console.info(`[eof-worker] listening on :${PORT}`)
  if (!SECRET) console.warn('[eof-worker] EOF_WORKER_SECRET is missing — /eof-worker/render will 503')
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    console.warn('[eof-worker] DATABASE_URL / POSTGRES_URL missing — job loads will fail')
  }
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    console.warn('[eof-worker] VERCEL env is set — unset it so encodes use the full (non-Pro-cap) profile')
  }
  if (!isYtDlpCookiesConfigured()) {
    console.warn(
      '[eof-worker] EOF_YTDLP_COOKIES_B64 / EOF_YTDLP_COOKIES_PATH missing — YouTube may block footage downloads',
    )
  }
  if (!isXaiConfigured()) {
    console.info(
      '[eof-worker] XAI_API_KEY not set — footage remains enabled; valid clips use their midpoint',
    )
  }
  // Check once at boot, not just lazily per-scene — a wrong Railway Builder
  // setting (Nixpacks/Railpack instead of the Dockerfile) silently ships a
  // worker with ffmpeg but no yt-dlp, and every real-footage attempt fails
  // with only a per-scene console.warn buried deep in a render log. Surface
  // it loudly here so a bad deploy is visible immediately in the boot logs.
  isYtDlpAvailable()
    .then((ok) => {
      if (ok) {
        console.info('[eof-worker] yt-dlp available — real-footage pipeline enabled')
      } else {
        console.warn(
          '[eof-worker] yt-dlp NOT FOUND — real-footage pipeline will fall back to images for every scene. ' +
            'Check the Railway service is actually building from the Dockerfile (Settings → Builder, or ' +
            'railway.toml [build] builder = "DOCKERFILE") — a Nixpacks/Railpack build does not install yt-dlp.',
        )
      }
    })
    .catch(() => {
      console.warn('[eof-worker] yt-dlp availability check failed to run')
    })
})
