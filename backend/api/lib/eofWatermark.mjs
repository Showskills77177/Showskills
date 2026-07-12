/**
 * Eyes Of Football overlays for Shorts:
 * - Brand mark: small top-left, free-roams in the final seconds
 * - Subscribe CTA: bottom-center, free-roams / scales in the final seconds
 *
 * Env:
 *   EOF_WATERMARK=1|0
 *   EOF_WATERMARK_PATH / EOF_WATERMARK_SIZE / EOF_WATERMARK_END_SEC
 *   EOF_SUBSCRIBE=1|0                 (default 1)
 *   EOF_SUBSCRIBE_PATH=...
 *   EOF_SUBSCRIBE_WIDTH=320           resting width (px)
 *   EOF_SUBSCRIBE_END_SEC=2.8
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

export function isEofSubscribeEnabled() {
  return envEnabled('EOF_SUBSCRIBE', true)
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
 * Burn brand watermark + subscribe CTA onto a finished Short MP4 (in place).
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
  const endSec = Math.min(
    Math.max(1.6, Number(process.env.EOF_WATERMARK_END_SEC) || Number(process.env.EOF_SUBSCRIBE_END_SEC) || 2.8),
    Math.max(1.5, total * 0.35),
  )
  const t0 = Math.max(0.5, total - endSec)
  const t0s = t0.toFixed(3)
  const ends = endSec.toFixed(3)

  const cornerW = Math.max(90, Math.min(220, Number(process.env.EOF_WATERMARK_SIZE) || 150))
  const endW = Math.round(cornerW * 2.05)
  const subW = Math.max(180, Math.min(480, Number(process.env.EOF_SUBSCRIBE_WIDTH) || 320))
  const subEndW = Math.round(subW * 1.35)

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
    filterParts.push(`[${i}:v]format=rgba,scale=${cornerW}:-1[wm_corner]`)
    filterParts.push(
      `[${i}:v]format=rgba,scale=${endW}:-1,rotate=a='0.14*sin(2*PI*t/2)':c=none:ow=rotw(iw):oh=roth(ih)[wm_roam]`,
    )
    filterParts.push(`[${lastLabel}][wm_corner]overlay=x=28:y=52:enable='lt(t\\,${t0s})'[v_wm1]`)
    filterParts.push(
      `[v_wm1][wm_roam]overlay=` +
        `x='28+160*sin(2*PI*(t-${t0s})/${ends})':` +
        `y='52+260*cos(2*PI*(t-${t0s})/2.3)':` +
        `enable='gte(t\\,${t0s})'[v_wm2]`,
    )
    lastLabel = 'v_wm2'
  }

  if (sub) {
    inputs.push('-loop', '1', '-t', durArg, '-i', sub)
    const i = inputIdx
    inputIdx += 1
    // Rest: bottom-center. End: grow + roam horizontally / bounce up a bit.
    filterParts.push(`[${i}:v]format=rgba,scale=${subW}:-1[sub_rest]`)
    filterParts.push(
      `[${i}:v]format=rgba,scale=${subEndW}:-1,rotate=a='0.08*sin(2*PI*t/1.8)':c=none:ow=rotw(iw):oh=roth(ih)[sub_roam]`,
    )
    filterParts.push(
      `[${lastLabel}][sub_rest]overlay=x=(W-w)/2:y=H-h-72:enable='lt(t\\,${t0s})'[v_sub1]`,
    )
    filterParts.push(
      `[v_sub1][sub_roam]overlay=` +
        `x='(W-w)/2+140*sin(2*PI*(t-${t0s})/${ends})':` +
        `y='H-h-72-120*abs(sin(2*PI*(t-${t0s})/2.1))':` +
        `enable='gte(t\\,${t0s})'[vout]`,
    )
    lastLabel = 'vout'
  } else {
    // rename last to vout
    filterParts.push(`[${lastLabel}]null[vout]`)
    lastLabel = 'vout'
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
      subW,
      endSec,
      total,
    }
  } catch (e) {
    await unlink(tmp).catch(() => {})
    throw e
  }
}
