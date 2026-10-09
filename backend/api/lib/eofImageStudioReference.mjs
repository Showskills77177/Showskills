/**
 * Image Studio "reference" inputs — a reference image and/or a pasted document excerpt that get
 * folded into the Grok Imagine prompt as extra context.
 *
 * xAI's images/generations endpoint is text-prompt only (no image-to-image / reference-image
 * parameter as of this writing), so a reference photo can't be used for pixel-level conditioning.
 * Instead we ask Grok vision (chat/completions) to describe it, then weave that description into
 * the final generation prompt — good enough to steer subject/style/composition, not a literal edit.
 */
import { getXaiApiKey, isXaiConfigured, xaiModelCandidates } from './eofXaiClient.mjs'

export const MAX_REFERENCE_IMAGE_BYTES = 6_000_000 // decoded bytes — keeps the JSON POST well under Vercel's body cap
export const MAX_REFERENCE_IMAGES = 5
export const MAX_DOCUMENT_TEXT_CHARS = 6_000
const VISION_TIMEOUT_MS = 30_000

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i

export function isEofImageStudioReferenceConfigured() {
  return isXaiConfigured()
}

/** Parse + size-validate a `data:image/...;base64,...` string. Throws on anything suspicious. */
export function parseEofReferenceImageDataUrl(dataUrl) {
  const raw = String(dataUrl || '').trim()
  const m = DATA_URL_RE.exec(raw)
  if (!m) throw new Error('Reference image must be a JPEG, PNG, or WEBP data URL.')
  const mime = m[1].toLowerCase()
  const b64 = m[2].replace(/\s/g, '')
  const buffer = Buffer.from(b64, 'base64')
  if (!buffer.length) throw new Error('Reference image is empty.')
  if (buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error(`Reference image is too large (max ${Math.round(MAX_REFERENCE_IMAGE_BYTES / 1_000_000)}MB).`)
  }
  return { mime, buffer, dataUrl: `data:${mime};base64,${b64}` }
}

/** Parse + size-validate up to `MAX_REFERENCE_IMAGES` data URLs. Throws on anything suspicious. */
export function parseEofReferenceImageDataUrls(list) {
  const raw = Array.isArray(list) ? list : []
  const trimmed = raw.map((v) => String(v || '').trim()).filter(Boolean)
  if (trimmed.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`Up to ${MAX_REFERENCE_IMAGES} reference images are supported.`)
  }
  return trimmed.map((dataUrl) => parseEofReferenceImageDataUrl(dataUrl))
}

export function truncateEofDocumentText(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  return raw.length > MAX_DOCUMENT_TEXT_CHARS ? `${raw.slice(0, MAX_DOCUMENT_TEXT_CHARS)}…` : raw
}

/**
 * Ask Grok vision to describe a reference image (subject, style, composition, colors, mood) in a
 * short paragraph suitable for folding into an image-generation prompt.
 * @param {{ dataUrl: string, signal?: AbortSignal }} opts
 * @returns {Promise<string>}
 */
export async function describeEofReferenceImage(opts = {}) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')
  const dataUrl = String(opts.dataUrl || '').trim()
  if (!dataUrl) throw new Error('Reference image is required')

  const model = xaiModelCandidates()[0] || 'grok-2-latest'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Describe this reference image in 2-4 sentences for an AI image-generation prompt: subject(s), ' +
              'composition/framing, color palette, lighting, and art style/mood. Plain prose only, no preamble.',
          },
          {
            role: 'user',
            content: [{ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }],
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`xAI vision ${res.status}: ${errText.slice(0, 240)}`)
    }
    const data = await res.json()
    const text = String(data?.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new Error('empty vision description')
    return text.length > 900 ? `${text.slice(0, 900)}…` : text
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask Grok vision to describe up to `MAX_REFERENCE_IMAGES` reference images together (subject,
 * style, composition, colors, mood) in one short paragraph suitable for folding into an
 * image-generation prompt.
 * @param {{ dataUrls: string[], signal?: AbortSignal }} opts
 * @returns {Promise<string>}
 */
export async function describeEofReferenceImages(opts = {}) {
  const key = getXaiApiKey()
  if (!key) throw new Error('XAI_API_KEY is not set')
  const dataUrls = (Array.isArray(opts.dataUrls) ? opts.dataUrls : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  if (!dataUrls.length) throw new Error('At least one reference image is required')
  if (dataUrls.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`Up to ${MAX_REFERENCE_IMAGES} reference images are supported.`)
  }
  // A single image reuses the exact same request shape as describeEofReferenceImage above.
  if (dataUrls.length === 1) return describeEofReferenceImage({ dataUrl: dataUrls[0], signal: opts.signal })

  const model = xaiModelCandidates()[0] || 'grok-2-latest'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              `Describe these ${dataUrls.length} reference images together in 3-6 sentences for an AI ` +
              'image-generation prompt: shared subject(s)/theme, composition/framing, color palette, lighting, ' +
              'and art style/mood across all of them. Plain prose only, no preamble.',
          },
          {
            role: 'user',
            content: dataUrls.map((dataUrl) => ({ type: 'image_url', image_url: { url: dataUrl, detail: 'low' } })),
          },
        ],
      }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`xAI vision ${res.status}: ${errText.slice(0, 240)}`)
    }
    const data = await res.json()
    const text = String(data?.choices?.[0]?.message?.content || '').trim()
    if (!text) throw new Error('empty vision description')
    return text.length > 900 ? `${text.slice(0, 900)}…` : text
  } finally {
    clearTimeout(timer)
  }
}

/** Weave the user prompt, an optional document excerpt, and an optional reference-image description together. */
export function buildEofImageStudioPrompt({ prompt, documentExcerpt, referenceDescription }) {
  const parts = [String(prompt || '').trim()]
  const doc = String(documentExcerpt || '').trim()
  if (doc) parts.push(`Context from an attached document (for ideas/details, not to render as text): ${doc}`)
  const ref = String(referenceDescription || '').trim()
  if (ref) parts.push(`Match the style/subject/composition of the attached reference image(s): ${ref}`)
  return parts.filter(Boolean).join('\n\n')
}
