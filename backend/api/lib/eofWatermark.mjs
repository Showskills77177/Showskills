/**
 * Eyes Of Football overlays for Shorts (static — never animate / free-roam):
 * - Brand logo: circular World Cup badge, top-left, sized to cover ZapCap’s free corner stamp
 * - Subscribe CTA: OFF by default (was cluttering the Short)
 *
 * Env:
 *   EOF_WATERMARK=1|0
 *   EOF_WATERMARK_PATH / EOF_WATERMARK_SIZE / EOF_WATERMARK_X / EOF_WATERMARK_Y
 *   EOF_SUBSCRIBE=1|0  (default off)
 *   EOF_SUBSCRIBE_PATH / EOF_SUBSCRIBE_WIDTH
 */
import { existsSync } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg, runFfprobe } from './eofFfmpeg.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const WATERMARK_CANDIDATES = [
  process.env.EOF_WATERMARK_PATH,
  join(ROOT, 'assets/eof/eof-watermark.png'),
  join(ROOT, 'public/eof/branding/eof-watermark.png'),
].filter(Boolean)

const SUBSCRIBE_CANDIDATES = [
  process.env.EOF_SUBSCRIBE_PATH,
  join(ROOT, 'assets/eof/eof-subscribe.png'),
  join(ROOT, 'public/eof/branding/eof-subscribe.png'),
].filter(Boolean)

function envEnabled(name, defaultOn = true) {
  const raw = String(process.env[name] ?? (defaultOn ? '1' : '0'))
    .trim()
    .toLowerCase()
  if (!raw && defaultOn) return true
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no'
}

export function isEofWatermarkEnabled() {
  return envEnabled('EOF_WATERMARK', true)
}

/** Subscribe CTA is off unless EOF_SUBSCRIBE=1 — it cluttered the Short. */
export function isEofSubscribeEnabled() {
  return envEnabled('EOF_SUBSCRIBE', false)
}

export function resolveEofWatermarkPath() {
  for (const p of WATERMARK_CANDIDATES) {
    if (p && existsSync(p)) return p
  }
  return null
}

export function resolveEofSubscribePath() {
  for (const p of SUBSCRIBE_CANDIDATES) {
    if (p && existsSync(p)) return p
  }
  return null
}

async function probeDurationSec(videoPath) {
  try {
    const { stdout } = await runFfprobe([
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      videoPath,
    ])
    const n = Number(String(stdout || '').trim())
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/**
 * Burn brand watermark (+ optional subscribe) onto a finished Short MP4 (in place).
 * Applied AFTER ZapCap so the circular EOF badge sits on top of ZapCap’s free stamp.
 * @param {{ videoPath: string, durationSec?: number }} opts
 */
export async function applyEofWatermark({ videoPath, durationSec } = {}) {
  const wantWm = isEofWatermarkEnabled()
  const wantSub = isEofSubscribeEnabled()
  const mark = wantWm ? resolveEofWatermarkPath() : null
  const sub = wantSub ? resolveEofSubscribePath() : null

  if (!mark && !sub) {
    return { applied: false, reason: !wantWm && !wantSub ? 'disabled' : 'missing-asset' }
  }
  if (!videoPath || !existsSync(videoPath)) throw new Error('video missing for watermark')

  const probed = await probeDurationSec(videoPath)
  const total = Math.max(4, Number(durationSec) || probed || 20)
  // Large top-left badge — covers ZapCap’s free corner stamp (no white wordmark, no roam)
  const cornerW = Math.max(280, Math.min(520, Number(process.env.EOF_WATERMARK_SIZE) || 440))
  const markX = Math.max(4, Math.min(80, Number(process.env.EOF_WATERMARK_X) || 16))
  const markY = Math.max(8, Math.min(120, Number(process.env.EOF_WATERMARK_Y) || 24))
  const subW = Math.max(200, Math.min(520, Number(process.env.EOF_SUBSCRIBE_WIDTH) || 340))

  const inputs = ['-y', '-i', videoPath]
  const durArg = total.toFixed(3)
  /** @type {string[]} */
  const filterParts = []
  let inputIdx = 1
  let lastLabel = '0:v'

  if (mark) {
    inputs.push('-loop', '1', '-t', durArg, '-i', mark)
    const i = inputIdx
    inputIdx += 1
    filterParts.push(`[${i}:v]format=rgba,scale=${cornerW}:${cornerW}[wm]`)
    filterParts.push(`[${lastLabel}][wm]overlay=x=${markX}:y=${markY}:format=auto[v_wm]`)
    lastLabel = 'v_wm'
  }

  if (sub) {
    inputs.push('-loop', '1', '-t', durArg, '-i', sub)
    const i = inputIdx
    inputIdx += 1
    filterParts.push(`[${i}:v]format=rgba,scale=${subW}:-1[sub]`)
    filterParts.push(`[${lastLabel}][sub]overlay=x=(W-w)/2:y=H-h-64:format=auto[vout]`)
    lastLabel = 'vout'
  } else {
    filterParts.push(`[${lastLabel}]null[vout]`)
  }

  const tmp = `${videoPath}.wm.tmp.mp4`
  const args = [
    ...inputs,
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[vout]',
    '-map',
    '0:a?',
    '-c:v',
    'libx264',
    '-preset',
    process.env.EOF_VIDEO_PRESET || 'ultrafast',
    '-crf',
    process.env.EOF_VIDEO_CRF || '28',
    '-c:a',
    'copy',
    '-t',
    durArg,
    '-movflags',
    '+faststart',
    tmp,
  ]

  try {
    await runFfmpeg(args, { maxBuffer: 32 * 1024 * 1024 })
    if (!existsSync(tmp)) throw new Error('watermark render produced no file')
    await unlink(videoPath).catch(() => {})
    await rename(tmp, videoPath)
    return {
      applied: true,
      watermark: Boolean(mark),
      subscribe: Boolean(sub),
      watermarkPath: mark,
      subscribePath: sub,
      cornerW,
      markX,
      markY,
      subW,
      static: true,
      total,
    }
  } catch (e) {
    await unlink(tmp).catch(() => {})
    throw e
  }
}
