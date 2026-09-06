/**
 * Phase 2 — vision-based exact-moment matching. Samples frames from a
 * downloaded source video with ffmpeg, then asks Grok vision (same xAI
 * client used for still-image ranking in eofImageVision.mjs) which frame
 * best matches the scene's narration, so we can cut a clip window centered
 * on that timestamp instead of just grabbing the middle of the source.
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runFfmpeg } from './eofFfmpeg.mjs'
import { getXaiApiKey, isXaiConfigured, xaiModelCandidates } from './eofXaiClient.mjs'
import { isEofVercelRuntime } from './eofProductionServerless.mjs'

/** Never let frame-matching burn the Vercel isolate's 300s budget — Railway-only in practice. */
function frameMatchTimeoutMs() {
  const fromEnv = Number(process.env.EOF_VIDEO_FRAME_MATCH_TIMEOUT_MS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return isEofVercelRuntime() ? 8_000 : 30_000
}

function parseJsonContent(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

/**
 * Extract N evenly-spaced JPEG frames from a source video into a scratch dir.
 * @param {string} filePath
 * @param {{ durationSec: number, maxFrames?: number }} opts
 * @returns {Promise<Array<{ path: string, timestampSec: number }>>}
 */
export async function sampleEofVideoFrames(filePath, opts = {}) {
  const durationSec = Math.max(1, Number(opts.durationSec) || 1)
  const maxFrames = Math.max(3, Math.min(12, Number(opts.maxFrames) || 8))
  const dir = mkdtempSync(path.join(tmpdir(), 'eof-frames-'))
  // Sample inside the middle 90% of the clip — avoid intro/outro cards.
  const margin = durationSec * 0.05
  const usable = Math.max(0.5, durationSec - margin * 2)
  const step = usable / maxFrames

  const frames = []
  for (let i = 0; i < maxFrames; i += 1) {
    const ts = margin + step * i + step / 2
    const outPath = path.join(dir, `frame-${i}.jpg`)
    try {
      await runFfmpeg(['-ss', String(ts), '-i', filePath, '-frames:v', '1', '-q:v', '3', '-y', outPath], {
        timeoutMs: 15_000,
      })
      frames.push({ path: outPath, timestampSec: ts })
    } catch {
      /* skip frame we couldn't extract */
    }
  }
  return frames
}

function cleanupFrameDir(frames) {
  const dir = frames?.[0]?.path ? path.dirname(frames[0].path) : null
  if (dir) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  }
}

/**
 * Ask Grok vision which sampled frame best depicts the scene's narration/moment.
 * Frames are local files, so we send base64 data URLs rather than public URLs.
 * @param {Array<{ path: string, timestampSec: number }>} frames
 * @param {{ sceneCaption: string, subject?: string }} opts
 * @returns {Promise<{ bestTimestampSec: number|null, score: number, reason: string, evaluated: boolean }>}
 */
export async function matchEofVideoFramesToScene(frames, opts = {}) {
  const none = { bestTimestampSec: null, score: 0, reason: 'not evaluated', evaluated: false }
  if (!isXaiConfigured() || !frames?.length) return none

  const subject = String(opts.subject || '').trim()
  const sceneCaption = String(opts.sceneCaption || '').trim()
  if (!sceneCaption) return none

  const key = getXaiApiKey()
  const model = xaiModelCandidates()[0] || 'grok-2-latest'

  const content = [
    {
      type: 'text',
      text: `These are sequential frames sampled from one source video, in order.
Scene narration this clip must visually match: "${sceneCaption}"
${subject ? `Subject: ${subject}` : ''}

Return JSON only: { "best_index": number, "score": number, "reason": string }
- best_index: 1-based index of the single frame that best matches the described moment.
- score: 0-10, how well that frame actually depicts the described moment (not just "a football scene").
- If NONE of the frames plausibly show the described moment, set score <= 3 and best_index to the least-bad frame.
- Be strict: a generic match ("a football scene") is NOT the same as the specific described moment.`,
    },
    ...frames.map((f) => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${readFileSync(f.path).toString('base64')}`, detail: 'low' },
    })),
  ]

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content }],
      }),
      signal: AbortSignal.timeout(frameMatchTimeoutMs()),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.warn('[eof-video-frame-match] xAI failed', res.status, err.slice(0, 160))
      return none
    }
    const data = await res.json()
    const parsed = parseJsonContent(data?.choices?.[0]?.message?.content)
    const idx = Number(parsed?.best_index) - 1
    const score = Math.max(0, Math.min(10, Number(parsed?.score) || 0))
    const frame = frames[idx]
    return {
      bestTimestampSec: frame ? frame.timestampSec : null,
      score,
      reason: String(parsed?.reason || ''),
      evaluated: true,
    }
  } catch (e) {
    console.warn('[eof-video-frame-match] skipped', e instanceof Error ? e.message : e)
    return none
  }
}

/** Minimum score to trust a vision match — below this, treat as "no real moment found". */
export const MIN_EOF_VIDEO_FRAME_MATCH_SCORE = 5

/**
 * Full Phase 2 flow: sample frames, ask vision which best matches, clean up.
 * @param {{ filePath: string, durationSec: number, sceneCaption: string, subject?: string }} input
 */
export async function findBestEofVideoMoment({ filePath, durationSec, sceneCaption, subject }) {
  const frames = await sampleEofVideoFrames(filePath, { durationSec })
  if (!frames.length) {
    return {
      bestTimestampSec: null,
      score: 0,
      matched: false,
      reason: 'no frames sampled',
      evaluated: false,
    }
  }
  try {
    const result = await matchEofVideoFramesToScene(frames, { sceneCaption, subject })
    return { ...result, matched: result.score >= MIN_EOF_VIDEO_FRAME_MATCH_SCORE }
  } finally {
    cleanupFrameDir(frames)
  }
}
