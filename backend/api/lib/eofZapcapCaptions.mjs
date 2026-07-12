/**
 * Optional ZapCap animated captions (CapCut-class, word-synced).
 * When ZAPCAP_API_KEY is set and EOF_CAPTION_ENGINE=zapcap (or auto),
 * the finished Short is re-captioned via ZapCap templates.
 *
 * Env:
 *   ZAPCAP_API_KEY / EOF_ZAPCAP_API_KEY
 *   EOF_CAPTION_ENGINE=local|zapcap|auto   (default auto = ZapCap when keyed)
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

/** local | zapcap — auto picks ZapCap when keyed. */
export function resolveCaptionEngine() {
  const raw = envKey('EOF_CAPTION_ENGINE', 'EOF_CAPTIONS_ENGINE').toLowerCase() || 'auto'
  if (raw === 'zapcap' || raw === 'zap') return isZapcapConfigured() ? 'zapcap' : 'local'
  if (raw === 'local' || raw === 'ffmpeg' || raw === 'drawtext') return 'local'
  // auto
  return isZapcapConfigured() ? 'zapcap' : 'local'
}

function zapcapTemplateId(styleId) {
  const meta = getEofCaptionStyle(styleId)
  return envKey(meta.zapcapTemplateEnv, `EOF_${meta.zapcapTemplateEnv}`) || meta.zapcapTemplateDefault
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

/**
 * Prefer matching ZapCap template by name; fall back to env/default UUID.
 */
export async function resolveZapcapTemplateId(style) {
  const styleId = resolveEofCaptionStyle(style)
  const fallback = zapcapTemplateId(styleId)
  const key = getZapcapApiKey()
  if (!key) {
    if (!fallback) throw new Error(`Set ${getEofCaptionStyle(styleId).zapcapTemplateEnv} or ZAPCAP_API_KEY`)
    return fallback
  }

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
    const needles =
      styleId === 'beast'
        ? ['beast', 'mrbeast']
        : styleId === 'karaoke'
          ? ['tracy', 'karaoke', 'fill', 'word']
          : ['hormozi', 'pop', 'classic', 'ali']
    const hit = list.find((t) => {
      const name = String(t?.name || t?.title || t?.label || '').toLowerCase()
      return needles.some((n) => name.includes(n))
    })
    if (hit?.id) return String(hit.id)
    if (list[0]?.id && !fallback) return String(list[0].id)
  } catch (e) {
    console.warn('[eof-zapcap] templates lookup failed', e instanceof Error ? e.message : e)
    if (!fallback) throw e
  }
  if (!fallback) throw new Error('No ZapCap template found — set ZAPCAP_TEMPLATE_POP / KARAOKE / BEAST')
  return fallback
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

async function createTask(videoId, { style, displayWords }) {
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
export async function burnZapcapCaptions({ videoPath, style, displayWords } = {}) {
  if (!isZapcapConfigured()) throw new Error('ZAPCAP_API_KEY is not set')
  if (!videoPath || !existsSync(videoPath)) throw new Error('video file missing for ZapCap')

  const styleId = resolveEofCaptionStyle(style)
  console.info('[eof-zapcap] uploading', videoPath, 'style', styleId)
  const videoId = await uploadVideoFile(videoPath)
  const { taskId, templateId } = await createTask(videoId, { style: styleId, displayWords })
  console.info('[eof-zapcap] task', taskId, 'template', templateId)
  const downloadUrl = await pollTask(videoId, taskId)
  await downloadToFile(downloadUrl, videoPath)
  return { engine: 'zapcap', templateId, style: styleId }
}

/** Status for Production UI. */
export function eofCaptionEngineStatus() {
  const zapcap = isZapcapConfigured()
  return {
    engine: resolveCaptionEngine(),
    zapcap,
    local: true,
  }
}