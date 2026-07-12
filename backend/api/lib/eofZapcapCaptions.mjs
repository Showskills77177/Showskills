/**
 * ZapCap animated captions (CapCut-class, word-synced) for EOF Shorts.
 *
 * Production path: clean plate video → ZapCap burn (~$0.10/min).
 * Local ffmpeg drawtext only when EOF_CAPTION_ENGINE=local.
 *
 * Env:
 *   ZAPCAP_API_KEY / EOF_ZAPCAP_API_KEY
 *   EOF_CAPTION_ENGINE=auto|zapcap|local|none
 *     auto  = ZapCap when keyed, else none (clean plate, no ugly local burn)
 *     zapcap = require ZapCap key
 *     local  = ffmpeg drawtext escape hatch
 *     none   = never burn captions
 *   ZAPCAP_TEMPLATE_POP / KARAOKE / BEAST  optional template UUID overrides
 */
import { existsSync } from 'node:fs'
import { unlink, rename, writeFile } from 'node:fs/promises'
import { getEofCaptionStyle, resolveEofCaptionStyle } from '../../../shared/eofCaptionStyles.mjs'

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function getZapcapApiKey() {
  return envKey('ZAPCAP_API_KEY', 'EOF_ZAPCAP_API_KEY', 'ZAPCAP_KEY')
}

export function isZapcapConfigured() {
  return Boolean(getZapcapApiKey())
}

/**
 * @returns {'zapcap' | 'local' | 'none'}
 */
export function resolveCaptionEngine() {
  const raw = envKey('EOF_CAPTION_ENGINE', 'EOF_CAPTIONS_ENGINE').toLowerCase() || 'auto'
  if (raw === 'local' || raw === 'ffmpeg' || raw === 'drawtext') return 'local'
  if (raw === 'none' || raw === 'off' || raw === 'skip') return 'none'
  if (raw === 'zapcap' || raw === 'zap') {
    if (!isZapcapConfigured()) {
      throw new Error('EOF_CAPTION_ENGINE=zapcap but ZAPCAP_API_KEY is not set')
    }
    return 'zapcap'
  }
  // auto — never silently fall back to crude local burn
  return isZapcapConfigured() ? 'zapcap' : 'none'
}

function zapcapTemplateId(styleId) {
  const meta = getEofCaptionStyle(styleId)
  return envKey(meta.zapcapTemplateEnv, `EOF_${meta.zapcapTemplateEnv}`) || meta.zapcapTemplateDefault
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

/**
 * Prefer matching ZapCap template by name; fail loudly if nothing matches and no env UUID.
 */
export async function resolveZapcapTemplateId(style) {
  const styleId = resolveEofCaptionStyle(style)
  const fallback = zapcapTemplateId(styleId)
  const key = getZapcapApiKey()
  const styleLabel = getEofCaptionStyle(styleId).label

  if (!key) {
    if (!fallback) {
      throw new Error(
        `ZapCap template missing for “${styleLabel}”. Set ${getEofCaptionStyle(styleId).zapcapTemplateEnv} or ZAPCAP_API_KEY.`,
      )
    }
    return fallback
  }

  const needles =
    styleId === 'beast'
      ? ['beast', 'mrbeast']
      : styleId === 'karaoke'
        ? ['tracy', 'karaoke', 'fill']
        : ['hormozi', 'pop', 'ali', 'classic']

  try {
    const res = await fetch('https://api.zapcap.ai/templates', {
      headers: { 'x-api-key': key },
    })
    if (!res.ok) {
      if (fallback) return fallback
      throw new Error(`ZapCap templates ${res.status}`)
    }
    const data = await res.json()
    const list = Array.isArray(data) ? data : Array.isArray(data?.templates) ? data.templates : []
    const hit = list.find((t) => {
      const name = String(t?.name || t?.title || t?.label || '').toLowerCase()
      return needles.some((n) => name.includes(n))
    })
    if (hit?.id) return String(hit.id)
  } catch (e) {
    console.warn('[eof-zapcap] templates lookup failed', e instanceof Error ? e.message : e)
    if (!fallback) throw e
  }

  if (fallback) return fallback
  throw new Error(
    `No ZapCap template matched “${styleLabel}”. Set ${getEofCaptionStyle(styleId).zapcapTemplateEnv}=<uuid> from https://zapcap.ai (or GET /templates).`,
  )
}

/**
 * Build ZapCap BYOT word cues from scene narration + durations (Brian TTS timings).
 * @param {Array<{ caption?: string, narration?: string, durationSec?: number }>} scenes
 * @returns {Array<{ type: string, text: string, start_time: number, end_time: number }>}
 */
export function buildZapcapTranscriptFromScenes(scenes = []) {
  const cues = []
  let t = 0
  for (const scene of scenes) {
    const text = String(scene?.narration || scene?.caption || '')
      .trim()
      .replace(/\s+/g, ' ')
    const dur = Math.max(1.2, Number(scene?.durationSec) || 3)
    if (!text) {
      t += dur
      continue
    }
    const words = text.split(' ').filter(Boolean).slice(0, 40)
    if (!words.length) {
      t += dur
      continue
    }
    const weights = words.map((w) => Math.max(2, w.replace(/[^a-zA-Z0-9']/g, '').length || 2))
    const total = weights.reduce((a, b) => a + b, 0) || 1
    const lead = Math.min(0.08, dur * 0.02)
    const usable = Math.max(0.6, dur - lead - 0.04)
    let cursor = t + lead
    words.forEach((word, i) => {
      const slice = usable * (weights[i] / total)
      const start = Number(cursor.toFixed(3))
      const end = Number((i === words.length - 1 ? t + dur - 0.02 : cursor + slice).toFixed(3))
      cues.push({ type: 'word', text: word, start_time: start, end_time: Math.max(start + 0.05, end) })
      cursor = end
    })
    t += dur
  }
  return cues
}

async function uploadVideoFile(filePath) {
  const key = getZapcapApiKey()
  const form = new FormData()
  const buf = await import('node:fs/promises').then((fs) => fs.readFile(filePath))
  form.append('file', new Blob([buf], { type: 'video/mp4' }), 'short.mp4')

  const res = await fetch('https://api.zapcap.ai/videos', {
    method: 'POST',
    headers: { 'x-api-key': key },
    body: form,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`ZapCap upload ${res.status}: ${err.slice(0, 200)}`)
  }
  const data = await res.json()
  const id = data?.id || data?.videoId
  if (!id) throw new Error('ZapCap upload returned no video id')
  return String(id)
}

async function createTask(videoId, { style, displayWords, transcript }) {
  const key = getZapcapApiKey()
  const templateId = await resolveZapcapTemplateId(style)
  const meta = getEofCaptionStyle(style)
  const body = {
    templateId,
    autoApprove: true,
    language: 'en',
    renderOptions: {
      subsOptions: {
        animation: true,
        emphasizeKeywords: true,
        displayWords: displayWords || meta.displayWords,
      },
      styleOptions: {
        fontUppercase: true,
        fontShadow: 'l',
      },
    },
  }
  if (Array.isArray(transcript) && transcript.length) {
    body.transcript = transcript
  }

  const res = await fetch(`https://api.zapcap.ai/videos/${videoId}/task`, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`ZapCap task ${res.status}: ${err.slice(0, 220)}`)
  }
  const data = await res.json()
  const taskId = data?.taskId || data?.id
  if (!taskId) throw new Error('ZapCap task returned no taskId')
  return { taskId: String(taskId), templateId }
}

async function pollTask(videoId, taskId, { timeoutMs = 240000 } = {}) {
  const key = getZapcapApiKey()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`https://api.zapcap.ai/videos/${videoId}/task/${taskId}`, {
      headers: { 'x-api-key': key },
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`ZapCap poll ${res.status}: ${err.slice(0, 200)}`)
    }
    const data = await res.json()
    const status = String(data?.status || data?.state || '').toLowerCase()
    const downloadUrl =
      data?.downloadUrl || data?.renderUrl || data?.url || data?.result?.downloadUrl || null
    if (['completed', 'complete', 'done', 'success'].includes(status) && downloadUrl) {
      return String(downloadUrl)
    }
    if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
      throw new Error(`ZapCap render failed: ${data?.error || data?.message || status}`)
    }
    await sleep(2500)
  }
  throw new Error('ZapCap render timed out')
}

async function downloadToFile(url, outPath) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ZapCap download ${res.status}`)
  const tmp = `${outPath}.zapcap.tmp`
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(tmp, buf)
  if (existsSync(outPath)) await unlink(outPath).catch(() => {})
  await rename(tmp, outPath)
}

/**
 * Re-caption a finished Short MP4 with ZapCap animated templates.
 * @returns {Promise<{ engine: 'zapcap', templateId: string, style: string }>}
 */
export async function burnZapcapCaptions({ videoPath, style, displayWords, scenes } = {}) {
  if (!isZapcapConfigured()) throw new Error('ZAPCAP_API_KEY is not set')
  if (!videoPath || !existsSync(videoPath)) throw new Error('video file missing for ZapCap')

  const styleId = resolveEofCaptionStyle(style)
  const transcript = buildZapcapTranscriptFromScenes(scenes || [])
  console.info(
    '[eof-zapcap] uploading',
    videoPath,
    'style',
    styleId,
    'byotWords',
    transcript.length,
  )
  const videoId = await uploadVideoFile(videoPath)
  const { taskId, templateId } = await createTask(videoId, {
    style: styleId,
    displayWords,
    transcript,
  })
  console.info('[eof-zapcap] task', taskId, 'template', templateId)
  const downloadUrl = await pollTask(videoId, taskId)
  await downloadToFile(downloadUrl, videoPath)
  return { engine: 'zapcap', templateId, style: styleId }
}

/** Status for Production UI. */
export function eofCaptionEngineStatus() {
  const zapcap = isZapcapConfigured()
  let engine = 'none'
  try {
    engine = resolveCaptionEngine()
  } catch {
    engine = 'none'
  }
  return {
    engine,
    zapcap,
    local: engine === 'local',
    note: zapcap
      ? 'ZapCap ready — CapCut-class word-synced captions (~$0.10/min).'
      : 'Add ZAPCAP_API_KEY for CapCut-class captions. Without it, Shorts render with no on-screen captions (local burn disabled).',
  }
}
