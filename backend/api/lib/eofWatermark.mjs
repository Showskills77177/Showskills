/**
 * Eyes Of Football overlays for Shorts (static — never animate / free-roam):
 * - Brand logo: circular World Cup badge, anchored over ZapCap’s free watermark (top-left default)
 * - Subscribe CTA: OFF by default (was cluttering the Short)
 *
 * Env:
 *   EOF_WATERMARK=1|0
 *   EOF_WATERMARK_PATH / EOF_WATERMARK_SIZE / EOF_WATERMARK_POSITION / EOF_WATERMARK_X / EOF_WATERMARK_Y
 *     POSITION: top-left (default) | top-center | top-right | bottom-left | bottom-center | bottom-right | center
 *   EOF_WATERMARK_OPACITY  0–1 alpha multiply (default 1 = fully opaque)
 *   EOF_SUBSCRIBE=1|0  (default off)
 *   EOF_SUBSCRIBE_PATH / EOF_SUBSCRIBE_WIDTH
 */
import { existsSync } from 'node:fs'
import { rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFfmpeg, runFfprobe } from './eofFfmpeg.mjs'

/** Defaults for the top-left brand badge (tunable via env). */
export const EOF_WATERMARK_DEFAULTS = {
  /** Square badge width/height in px */
  size: 200,
  /** Inward inset from the anchored edge (matches original top-left padding). */
  x: 28,
  y: 52,
  /** Alpha multiply — 1 = solid; lower = more see-through. */
  opacity: 1,
  position: 'top-left',
}

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

/**
 * ffmpeg overlay x/y expressions for a named anchor on the 1080x1920 canvas (W,H = main, w,h = badge).
 * mx/my are inward nudges from the anchored edge/corner.
 * @param {string} position
 * @param {number} mx
 * @param {number} my
 */
export function watermarkOverlayXY(position, mx = 0, my = 0) {
  const pos = String(position || EOF_WATERMARK_DEFAULTS.position).trim().toLowerCase()
  const left = `${mx}`
  const right = `W-w-${mx}`
  const centerX = `(W-w)/2+${mx}`
  const top = `${my}`
  const bottom = `H-h-${my}`
  const centerY = `(H-h)/2+${my}`
  switch (pos) {
    case 'top-left':
      return { x: left, y: top }
    case 'top-center':
      return { x: centerX, y: top }
    case 'top-right':
      return { x: right, y: top }
    case 'center':
      return { x: centerX, y: centerY }
    case 'bottom-left':
      return { x: left, y: bottom }
    case 'bottom-right':
      return { x: right, y: bottom }
    case 'bottom-center':
    default:
      return { x: centerX, y: bottom }
  }
}

/**
 * Resolve badge size / inset / opacity / anchor from env (with defaults).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function resolveEofWatermarkLayout(env = process.env) {
  const cornerW = Math.max(
    120,
    Math.min(420, Number(env.EOF_WATERMARK_SIZE) || EOF_WATERMARK_DEFAULTS.size),
  )
  const markX = Math.max(
    0,
    Math.min(400, Number(env.EOF_WATERMARK_X ?? EOF_WATERMARK_DEFAULTS.x)),
  )
  const markY = Math.max(
    0,
    Math.min(400, Number(env.EOF_WATERMARK_Y ?? EOF_WATERMARK_DEFAULTS.y)),
  )
  // Default 1 (solid). Clamp so a “~10% more opaque” bump from a softer env value stays in range.
  const opacity = Math.max(
    0.05,
    Math.min(1, Number(env.EOF_WATERMARK_OPACITY ?? EOF_WATERMARK_DEFAULTS.opacity)),
  )
  const position = String(env.EOF_WATERMARK_POSITION || EOF_WATERMARK_DEFAULTS.position)
    .trim()
    .toLowerCase()
  return { cornerW, markX, markY, opacity, position }
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
  // Badge sized to cover ZapCap’s free watermark (top-left). Inset from the frame edges so the
  // circle doesn’t sit flush on the crop — same padding convention as the original top-left burn
  // (x=28, y=52). Everything remains env-tunable:
  //   EOF_WATERMARK_POSITION  anchor: top-left|top-center|top-right|bottom-left|bottom-center|bottom-right|center
  //   EOF_WATERMARK_SIZE      badge width/height in px (square)
  //   EOF_WATERMARK_X / _Y    nudge from the anchor (px): inward from the anchored edge/corner
  //   EOF_WATERMARK_OPACITY   0–1 alpha multiply (default 1)
  const { cornerW, markX, markY, opacity, position } = resolveEofWatermarkLayout()
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
    const { x: overlayX, y: overlayY } = watermarkOverlayXY(position, markX, markY)
    // colorchannelmixer aa= multiplies the PNG alpha (1 = solid; <1 = more see-through).
    const aa = opacity.toFixed(3)
    filterParts.push(
      `[${i}:v]format=rgba,scale=${cornerW}:${cornerW},colorchannelmixer=aa=${aa}[wm]`,
    )
    filterParts.push(`[${lastLabel}][wm]overlay=x=${overlayX}:y=${overlayY}:format=auto[v_wm]`)
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
      opacity,
      position,
      subW,
      static: true,
      total,
    }
  } catch (e) {
    await unlink(tmp).catch(() => {})
    throw e
  }
}
