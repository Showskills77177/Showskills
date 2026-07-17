/**
 * xAI Grok Imagine (photorealistic press-photo) for EOF Shorts gapfill.
 *
 * POST https://api.x.ai/v1/images/generations
 * Model: grok-imagine-image-quality (~$0.05 / image)
 * Env: XAI_API_KEY (same key as script/vision)
 */
import { mkdirSync, existsSync } from 'node:fs'
import { writeFile, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { getXaiApiKey, isXaiConfigured } from './eofXaiClient.mjs'
import { buildEofImageGenPrompt } from './eofImageGenPrompt.mjs'

const DEFAULT_MODEL = 'grok-imagine-image-quality'
const DEFAULT_TIMEOUT_MS = 90_000

function envTrim(...names) {
  for (const name of names) {
    const v = String(process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function isEofGrokImagineConfigured() {
  return isXaiConfigured()
}

export function eofGrokImagineModel() {
  return envTrim('EOF_GROK_IMAGINE_MODEL', 'XAI_IMAGE_MODEL') || DEFAULT_MODEL
}

function requestTimeoutMs() {
  const n = Number(envTrim('EOF_GROK_IMAGINE_TIMEOUT_MS', 'XAI_IMAGE_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS)
  return Number.isFinite(n) && n >= 10_000 ? Math.min(n, 180_000) : DEFAULT_TIMEOUT_MS
}

function looksLikeImageBuffer(buf) {
  if (!buf || buf.length < 24) return false
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  return false
}

/**
 * Call xAI images/generations once.
 * @param {{ prompt: string, signal?: AbortSignal }} opts
 * @returns {Promise<{ url?: string, b64?: string }>}
 */
export async function requestGrokImagineImage(opts = {}) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')
  const prompt = String(opts.prompt || '').trim()
  if (!prompt) throw new Error('Grok Imagine prompt is required')

  const model = eofGrokImagineModel()
  const timeoutMs = requestTimeoutMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        aspect_ratio: '9:16',
        response_format: 'url',
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`xAI images ${res.status}: ${errText.slice(0, 240)}`)
    }
    const data = await res.json()
    const row = Array.isArray(data?.data) ? data.data[0] : null
    const url = row?.url ? String(row.url).trim() : ''
    const b64 = row?.b64_json ? String(row.b64_json).trim() : ''
    if (!url && !b64) throw new Error('empty Grok Imagine response')
    return { url: url || undefined, b64: b64 || undefined }
  } finally {
    clearTimeout(timer)
  }
}

async function materializeImage({ url, b64 }, outPath) {
  mkdirSync(dirname(outPath), { recursive: true })
  if (b64) {
    const buf = Buffer.from(b64, 'base64')
    if (!looksLikeImageBuffer(buf) || buf.length < 8_000) return false
    await writeFile(outPath, buf)
    return true
  }
  if (!url || !/^https?:\/\//i.test(url)) return false
  const imgRes = await fetch(url, {
    headers: {
      'User-Agent': 'ShowSkillsEOF/1.0 (eof-grok-imagine)',
      Accept: 'image/*,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  })
  if (!imgRes.ok) return false
  const buf = Buffer.from(await imgRes.arrayBuffer())
  if (!looksLikeImageBuffer(buf) || buf.length < 8_000) return false
  await writeFile(outPath, buf)
  return true
}

/**
 * Generate one photorealistic still; write bytes to workDir and return a pool hit.
 * @param {{
 *   subject: string,
 *   intent?: string,
 *   topic?: string,
 *   workDir: string,
 *   index?: number,
 *   signal?: AbortSignal,
 * }} opts
 */
export async function generateEofGrokImagineHit(opts = {}) {
  if (!isEofGrokImagineConfigured()) return null
  const subject = String(opts.subject || '').trim()
  if (!subject) return null
  const intent = String(opts.intent || 'neutral')
  const workDir = String(opts.workDir || '').trim()
  if (!workDir) throw new Error('workDir is required for Grok Imagine')

  const prompt = buildEofImageGenPrompt({
    subject,
    intent,
    topic: opts.topic,
  })
  const index = Math.max(0, Number(opts.index) || 0)
  const localPath = join(workDir, `gen-grok-${index + 1}.jpg`)

  const result = await requestGrokImagineImage({ prompt, signal: opts.signal })
  const ok = await materializeImage(result, localPath)
  if (!ok || !existsSync(localPath)) {
    console.warn('[eof-grok-imagine] materialize failed for', subject.slice(0, 40))
    return null
  }

  const remoteUrl = result.url || null
  return {
    url: remoteUrl || `file://${localPath}`,
    localPath,
    title: `${subject} — AI press photo (${intent})`,
    width: 768,
    height: 1344,
    source: 'grok-imagine',
    prompt,
  }
}

/**
 * Generate up to `count` Grok Imagine hits (sequential to respect rate limits).
 * @param {{ subject: string, intent?: string, topic?: string, workDir: string, count?: number, signal?: AbortSignal }} opts
 */
export async function fetchEofGrokImaginePool(opts = {}) {
  const count = Math.max(0, Math.min(6, Number(opts.count) || 1))
  if (!count || !isEofGrokImagineConfigured()) return []
  const hits = []
  for (let i = 0; i < count; i += 1) {
    try {
      const hit = await generateEofGrokImagineHit({ ...opts, index: i })
      if (hit) hits.push(hit)
    } catch (e) {
      console.warn('[eof-grok-imagine] generate failed', e instanceof Error ? e.message : e)
      break
    }
  }
  return hits
}

/** Copy a materialized gen still into the scene outPath. */
export async function copyEofGenHitToScene(hit, outPath) {
  const local = String(hit?.localPath || '').trim()
  if (local && existsSync(local)) {
    mkdirSync(dirname(outPath), { recursive: true })
    await copyFile(local, outPath)
    return true
  }
  return false
}
