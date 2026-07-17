/**
 * Free image generation fallback for EOF Shorts (Pollinations Flux).
 *
 * No API key required for anonymous access:
 *   GET https://image.pollinations.ai/prompt/{prompt}?width=&height=&model=flux
 *
 * Quality will not match Grok Imagine for named footballers (Rooney/Kane likeness),
 * but it returns real image bytes without a paid key — usable as secondary / gapfill.
 *
 * Optional: POLLINATIONS_API_KEY raises rate limits / removes watermark when set.
 */
import { mkdirSync, existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { buildEofImageGenPrompt } from './eofImageGenPrompt.mjs'

const DEFAULT_TIMEOUT_MS = 75_000

function envTrim(...names) {
  for (const name of names) {
    const v = String(process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

/** Always "configured" — Pollinations works without a key (rate-limited). */
export function isEofFreeGenConfigured() {
  const off = String(envTrim('EOF_FREE_GEN') || 'on').toLowerCase()
  return off !== '0' && off !== 'off' && off !== 'false'
}

export function getPollinationsApiKey() {
  return envTrim('POLLINATIONS_API_KEY', 'EOF_POLLINATIONS_API_KEY')
}

function looksLikeImageBuffer(buf) {
  if (!buf || buf.length < 24) return false
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true
  return false
}

/**
 * Build Pollinations GET URL for a prompt (9:16 portrait).
 * @param {string} prompt
 * @param {{ width?: number, height?: number, model?: string, seed?: number }} [opts]
 */
export function buildPollinationsImageUrl(prompt, opts = {}) {
  const encoded = encodeURIComponent(String(prompt || '').trim()).replace(/%20/g, '%20')
  const url = new URL(`https://image.pollinations.ai/prompt/${encoded}`)
  url.searchParams.set('width', String(opts.width || 768))
  url.searchParams.set('height', String(opts.height || 1344))
  url.searchParams.set('model', String(opts.model || envTrim('EOF_FREE_GEN_MODEL') || 'flux'))
  url.searchParams.set('nologo', 'true')
  url.searchParams.set('enhance', 'true')
  if (opts.seed != null && Number.isFinite(Number(opts.seed))) {
    url.searchParams.set('seed', String(Number(opts.seed)))
  }
  const key = getPollinationsApiKey()
  if (key) url.searchParams.set('key', key)
  return url.toString()
}

/**
 * Fetch one free-gen image and write to disk.
 * @param {{
 *   subject: string,
 *   intent?: string,
 *   topic?: string,
 *   workDir: string,
 *   index?: number,
 *   signal?: AbortSignal,
 * }} opts
 */
export async function generateEofFreeGenHit(opts = {}) {
  if (!isEofFreeGenConfigured()) return null
  const subject = String(opts.subject || '').trim()
  if (!subject) return null
  const intent = String(opts.intent || 'neutral')
  const workDir = String(opts.workDir || '').trim()
  if (!workDir) throw new Error('workDir is required for free-gen')

  const prompt = buildEofImageGenPrompt({
    subject,
    intent,
    topic: opts.topic,
  })
  const index = Math.max(0, Number(opts.index) || 0)
  const seed = 10_000 + index * 97 + (subject.length % 50)
  const imageUrl = buildPollinationsImageUrl(prompt, { seed })
  const localPath = join(workDir, `gen-free-${index + 1}.jpg`)
  mkdirSync(dirname(localPath), { recursive: true })

  const timeoutMs = Number(envTrim('EOF_FREE_GEN_TIMEOUT_MS') || DEFAULT_TIMEOUT_MS)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'ShowSkillsEOF/1.0 (eof-free-gen-pollinations)',
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`Pollinations ${res.status}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (!looksLikeImageBuffer(buf) || buf.length < 8_000) {
      throw new Error('Pollinations returned non-image / too small')
    }
    await writeFile(localPath, buf)
  } finally {
    clearTimeout(timer)
  }

  if (!existsSync(localPath)) return null

  return {
    // Prefer localPath for scene claim; keep generation URL for debugging only
    // (re-fetching Pollinations would regenerate a different image).
    url: `file://${localPath}`,
    localPath,
    title: `${subject} — free AI still (${intent})`,
    width: 768,
    height: 1344,
    source: 'free-gen',
    prompt,
    provider: 'pollinations',
  }
}

/**
 * @param {{ subject: string, intent?: string, topic?: string, workDir: string, count?: number, signal?: AbortSignal }} opts
 */
export async function fetchEofFreeGenPool(opts = {}) {
  const count = Math.max(0, Math.min(6, Number(opts.count) || 1))
  if (!count || !isEofFreeGenConfigured()) return []
  const hits = []
  for (let i = 0; i < count; i += 1) {
    try {
      const hit = await generateEofFreeGenHit({ ...opts, index: i })
      if (hit) hits.push(hit)
      // Anonymous Pollinations is ~1 req / 15s — small pause between gens.
      if (i + 1 < count) {
        await new Promise((r) => setTimeout(r, 1_200))
      }
    } catch (e) {
      console.warn('[eof-free-gen] generate failed', e instanceof Error ? e.message : e)
      break
    }
  }
  return hits
}
