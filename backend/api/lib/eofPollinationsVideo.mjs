/**
 * Pollinations AI text-to-video client ("Daily Stories" cartoon-video mode).
 *
 * Unlike the free/anonymous Pollinations *image* endpoint used elsewhere in this
 * codebase (eofFreeGenImages.mjs), video generation is a paid Pollinations endpoint
 * that requires an `sk_...` secret API key (Authorization: Bearer header):
 *
 *   GET https://gen.pollinations.ai/video/{prompt}?model=&duration=&aspectRatio=
 *   -> returns the finished clip directly as `video/mp4` bytes.
 *
 * Get a key at https://enter.pollinations.ai/keys and set POLLINATIONS_API_KEY
 * (same env var the free image client already reads). Pricing is billed in
 * "Pollen" per generated second and varies per model — check the live
 * `GET /video/models` catalogue for current rates before enabling this at scale.
 *
 * This client never throws on generation failure — it returns `null` so callers
 * can fall back to the existing illustrated-still pipeline for that scene.
 */
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getPollinationsApiKey } from './eofFreeGenImages.mjs'

const DEFAULT_TIMEOUT_MS = 180_000 // generation can take 30-90s+ per clip
const DEFAULT_MODEL = 'google/veo-3.1-fast'
const MIN_DURATION_SEC = 2
const MAX_DURATION_SEC = 10

function envTrim(...names) {
  for (const name of names) {
    const v = String(process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

/** Video generation needs a paid key — unlike the anonymous image endpoint. */
export function isEofPollinationsVideoConfigured() {
  return Boolean(getPollinationsApiKey())
}

export function getEofPollinationsVideoModel() {
  return envTrim('EOF_POLLINATIONS_VIDEO_MODEL') || DEFAULT_MODEL
}

/** Clamp a requested scene duration into a range most Pollinations video models accept. */
export function clampEofPollinationsVideoDuration(sec) {
  const n = Number(sec)
  if (!Number.isFinite(n) || n <= 0) return MIN_DURATION_SEC
  return Math.max(MIN_DURATION_SEC, Math.min(MAX_DURATION_SEC, Math.round(n)))
}

function looksLikeVideoBuffer(buf) {
  // MP4 ftyp box: bytes 4-7 are literally "ftyp".
  return Boolean(buf) && buf.length > 16 && buf.toString('ascii', 4, 8) === 'ftyp'
}

/**
 * Build the gen.pollinations.ai video GET URL for a prompt.
 * @param {string} prompt
 * @param {{ model?: string, durationSec?: number, aspectRatio?: string, audio?: boolean }} [opts]
 */
export function buildEofPollinationsVideoUrl(prompt, opts = {}) {
  const encoded = encodeURIComponent(String(prompt || '').trim())
  const url = new URL(`https://gen.pollinations.ai/video/${encoded}`)
  url.searchParams.set('model', String(opts.model || getEofPollinationsVideoModel()))
  url.searchParams.set('duration', String(clampEofPollinationsVideoDuration(opts.durationSec)))
  url.searchParams.set('aspectRatio', String(opts.aspectRatio || '9:16'))
  if (opts.audio != null) url.searchParams.set('audio', opts.audio ? 'true' : 'false')
  return url.toString()
}

/**
 * Generate one AI video clip and write it to `outPath`. Returns `null` (never
 * throws) on any failure — missing key, non-2xx, timeout, or an unrecognisable
 * response body — so the caller can fall back to a still image for the scene.
 * @param {{
 *   prompt: string,
 *   outPath: string,
 *   durationSec?: number,
 *   aspectRatio?: string,
 *   model?: string,
 *   signal?: AbortSignal,
 * }} opts
 * @returns {Promise<{ path: string, model: string, durationSec: number }|null>}
 */
export async function generateEofPollinationsVideoClip(opts = {}) {
  const prompt = String(opts.prompt || '').trim()
  const outPath = String(opts.outPath || '').trim()
  if (!prompt || !outPath) return null

  const apiKey = getPollinationsApiKey()
  if (!apiKey) {
    console.warn('[eof-pollinations-video] no API key configured — set POLLINATIONS_API_KEY')
    return null
  }

  const model = String(opts.model || getEofPollinationsVideoModel())
  const durationSec = clampEofPollinationsVideoDuration(opts.durationSec)
  const url = buildEofPollinationsVideoUrl(prompt, {
    model,
    durationSec,
    aspectRatio: opts.aspectRatio,
    audio: false, // captions/VO are burned/mixed in separately downstream
  })

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  if (opts.signal) opts.signal.addEventListener('abort', onAbort, { once: true })
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(
        '[eof-pollinations-video] request failed',
        res.status,
        body.slice(0, 200),
      )
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (!looksLikeVideoBuffer(buf)) {
      console.warn('[eof-pollinations-video] response did not look like an MP4 — skipping')
      return null
    }
    mkdirSync(dirname(outPath), { recursive: true })
    await writeFile(outPath, buf)
    return { path: outPath, model, durationSec }
  } catch (err) {
    console.warn(
      '[eof-pollinations-video] generation failed',
      err instanceof Error ? err.message : err,
    )
    return null
  } finally {
    clearTimeout(timeout)
    if (opts.signal) opts.signal.removeEventListener('abort', onAbort)
  }
}
