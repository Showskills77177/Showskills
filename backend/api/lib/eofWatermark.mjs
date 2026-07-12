/**
 * Eyes Of Football brand watermark overlay for Shorts.
 * - Small fixed mark top-left for most of the video
 * - Final ~2.8s: free-roam (move + scale + light rotate)
 *
 * Env:
 *   EOF_WATERMARK=1|0          (default 1)
 *   EOF_WATERMARK_PATH=...     optional absolute/relative PNG (RGBA)
 *   EOF_WATERMARK_SIZE=150     corner mark width (px)
 *   EOF_WATERMARK_END_SEC=2.8  roam duration at end
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

export function isEofWatermarkEnabled() {
  const raw = String(process.env.EOF_WATERMARK || '1').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no'
}

export function resolveEofWatermarkPath() {
  for (const p of WATERMARK_CANDIDATES) {
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
 * Burn Eyes Of Football watermark onto a finished Short MP4 (in place).
 * @param {{ videoPath: string, durationSec?: number }} opts
 */
export async function applyEofWatermark({ videoPath, durationSec } = {}) {
  if (!isEofWatermarkEnabled()) return { applied: false, reason: 'disabled' }
  const mark = resolveEofWatermarkPath()
  if (!mark) return { applied: false, reason: 'missing-asset' }
  if (!videoPath || !existsSync(videoPath)) throw new Error('video missing for watermark')

  const probed = await probeDurationSec(videoPath)
  const total = Math.max(4, Number(durationSec) || probed || 20)
  const endSec = Math.min(
    Math.max(1.6, Number(process.env.EOF_WATERMARK_END_SEC) || 2.8),
    Math.max(1.5, total * 0.35),
  )
  const t0 = Math.max(0.5, total - endSec)
  const cornerW = Math.max(90, Math.min(220, Number(process.env.EOF_WATERMARK_SIZE) || 150))
  const endW = Math.round(cornerW * 2.05)
  const t0s = t0.toFixed(3)
  const ends = endSec.toFixed(3)

  // Corner mark for most of the Short; final endSec: roam (x/y) + grow + light spin
  const filter = [
    `[1:v]format=rgba,` +
      `scale=${cornerW}:-1[wm_corner]`,
    `[1:v]format=rgba,` +
      `scale=${endW}:-1,` +
      `rotate=a='0.14*sin(2*PI*t/2)':c=none:ow=rotw(iw):oh=roth(ih)[wm_roam]`,
    `[0:v][wm_corner]overlay=x=28:y=52:enable='lt(t\\,${t0s})'[v1]`,
    `[v1][wm_roam]overlay=` +
      `x='28+160*sin(2*PI*(t-${t0s})/${ends})':` +
      `y='52+260*cos(2*PI*(t-${t0s})/2.3)':` +
      `enable='gte(t\\,${t0s})'[vout]`,
  ].join(';')

  const tmp = `${videoPath}.wm.tmp.mp4`
  const durArg = total.toFixed(3)
  const args = [
    '-y',
    '-i',
    videoPath,
    '-loop',
    '1',
    '-t',
    durArg,
    '-i',
    mark,
    '-filter_complex',
    filter,
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
    return { applied: true, path: mark, cornerW, endSec, total }
  } catch (e) {
    await unlink(tmp).catch(() => {})
    throw e
  }
}
