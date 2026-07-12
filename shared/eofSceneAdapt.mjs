import { defaultSceneImageQuery } from './eofSceneImageQueries.mjs'
import { EOF_MAX_SCENES, normalizeEofScript } from './eofScriptTemplates.mjs'

/**
 * Split plain narration into sentence chunks for Short scenes.
 * @param {string} draft
 */
export function splitDraftIntoSentences(draft) {
  const text = String(draft || '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return []

  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)

  if (parts.length >= 2) return parts

  // Very short drafts — clause split
  const clauses = text
    .split(/\s*[—–-]\s*|\s*,\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
  return clauses.length >= 2 ? clauses : parts.length ? parts : [text]
}

/**
 * Trim a sentence to on-screen caption length.
 * @param {string} sentence
 * @param {number} [maxWords]
 */
export function compressToSceneCaption(sentence, maxWords = 14) {
  const raw = String(sentence || '').trim()
  if (!raw) return ''
  const hasQ = raw.includes('?')
  const words = raw.replace(/\?+$/, '').split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return raw
  const cut = words.slice(0, maxWords).join(' ')
  return hasQ && !cut.includes('?') ? `${cut}?` : cut
}

function titleFromDraft(topic, draft) {
  const first = String(draft || '')
    .split(/[.!?]/)
    .map((s) => s.trim())
    .find(Boolean)
  if (first && first.length >= 12 && first.length <= 90) return first
  return String(topic || '').trim().slice(0, 90)
}

function distributeSentences(sentences, targetCount) {
  const n = sentences.length
  const target = Math.min(EOF_MAX_SCENES, Math.max(3, targetCount))
  if (n <= target) return sentences.map((s) => [s])

  const chunks = Array.from({ length: target }, () => [])
  for (let i = 0; i < n; i += 1) {
    chunks[Math.min(target - 1, Math.floor((i * target) / n))].push(sentences[i])
  }
  return chunks.map((c) => c.filter(Boolean))
}

/**
 * Deterministic fallback: split approved plain text into Short scenes (no AI).
 * Preserves draft facts; image queries stay tied to the topic (Messi, etc.).
 * @param {{ plainTextDraft: string, topic: string, format?: string }} input
 */
export function adaptPlainTextDraftToScenesLocally({ plainTextDraft, topic, format = 'news' }) {
  const draft = String(plainTextDraft || '').trim()
  const t = String(topic || '').trim() || 'Football'
  const sentences = splitDraftIntoSentences(draft)
  if (sentences.length < 2) return null

  const preferred = sentences.length >= 5 ? 5 : Math.min(6, Math.max(4, sentences.length))
  const groups = distributeSentences(sentences, preferred)
  if (groups.length < 3) return null

  const scenes = groups.map((group, i) => {
    const joined = group.join(' ')
    const caption = compressToSceneCaption(joined, i === groups.length - 1 ? 16 : 14)
    return {
      caption,
      imageQuery: defaultSceneImageQuery(`${t} ${caption}`, i),
      role: i === 0 ? 'hook' : i === groups.length - 1 ? 'cta' : 'body',
    }
  })

  const fmt = String(format || 'news').trim() || 'news'
  return normalizeEofScript(
    {
      topic: t,
      title: titleFromDraft(t, draft),
      description: `${t}. Eyes Of Football Short. #Shorts #shortsfeed #football`,
      tags: ['shortsfeed', 'football', 'shorts'],
      format: fmt,
      plainTextDraft: draft,
      scenes,
    },
    t,
  )
}

/**
 * Normalize AI adapt JSON — Groq sometimes nests under `script`.
 * @param {unknown} parsed
 */
export function unwrapAdaptJson(parsed) {
  if (!parsed || typeof parsed !== 'object') return parsed
  const obj = /** @type {Record<string, unknown>} */ (parsed)
  if (Array.isArray(obj.scenes) && obj.scenes.length) return obj
  const nested = obj.script
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const inner = /** @type {Record<string, unknown>} */ (nested)
    if (Array.isArray(inner.scenes) && inner.scenes.length) {
      return { ...inner, ...obj, scenes: inner.scenes }
    }
  }
  return obj
}
