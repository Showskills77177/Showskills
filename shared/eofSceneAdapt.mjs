import { defaultSceneImageQuery } from './eofSceneImageQueries.mjs'
import { EOF_MAX_SCENES, normalizeEofScript } from './eofScriptTemplates.mjs'

/**
 * Short scripts do not need 7 stills — prefer 3–5 beats.
 * @param {string} draft
 * @returns {{ min: number, max: number }}
 */
export function targetSceneCountForDraft(draft) {
  const words = wordCount(draft)
  const sentences = splitDraftIntoSentences(draft).length
  if (words < 70 || sentences <= 3) return { min: 3, max: 4 }
  if (words < 105 || sentences <= 4) return { min: 3, max: 5 }
  // Cap auto-adapt at 5 — more scenes = more same-face stills and wasted SERP picks
  return { min: 4, max: 5 }
}

/** Words in a phrase. */
function wordCount(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

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

  // Single long sentence — split on clause boundaries so we still get beats
  const clauses = text
    .split(/\s*[—–]\s*|\s*,\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 8)
  return clauses.length >= 2 ? clauses : parts.length ? parts : [text]
}

/**
 * Split a long sentence into caption-sized chunks WITHOUT dropping words.
 * Breaks on clause punctuation / conjunctions first, then word boundaries.
 * @param {string} sentence
 * @param {number} maxWords
 */
export function splitLongSentence(sentence, maxWords = 16) {
  const clean = String(sentence || '').trim()
  if (wordCount(clean) <= maxWords) return [clean]

  const clauses = clean
    .split(/(?<=[,;:])\s+|\s*[—–]\s*|\s+(?=(?:and|but|so|because|while|as|then|before|after)\b)/i)
    .map((s) => s.trim())
    .filter(Boolean)

  const merged = []
  let cur = ''
  for (const part of clauses) {
    const candidate = cur ? `${cur} ${part}` : part
    if (cur && wordCount(candidate) > maxWords) {
      merged.push(cur)
      cur = part
    } else {
      cur = candidate
    }
  }
  if (cur) merged.push(cur)

  // Any chunk still over budget (no punctuation) → hard split on word boundaries (keeps all words)
  const out = []
  for (const chunk of merged) {
    if (wordCount(chunk) <= maxWords) {
      out.push(chunk)
      continue
    }
    const words = chunk.split(/\s+/)
    for (let i = 0; i < words.length; i += maxWords) {
      out.push(words.slice(i, i + maxWords).join(' '))
    }
  }
  return out.filter(Boolean)
}

/**
 * Tidy a caption: collapse spaces, drop trailing punctuation, word-safe length cap.
 * Never cuts a word in half; only trims whole trailing words if extremely long.
 * @param {string} sentence
 */
export function tidyCaption(sentence) {
  let c = String(sentence || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,;:\-–—]+$/, '')
    .trim()
  if (c.length > 138) {
    const words = c.split(' ')
    let out = ''
    for (const w of words) {
      if ((out ? `${out} ${w}` : w).length > 138) break
      out = out ? `${out} ${w}` : w
    }
    c = out || c.slice(0, 138)
  }
  return c
}

/**
 * Balance sentence units into a sensible scene count (4..max) with clean, whole captions.
 * @param {string[]} sentences
 * @param {{ min?: number, max?: number, capWords?: number }} [opts]
 */
export function balanceSceneUnits(
  sentences,
  { min = 4, max = EOF_MAX_SCENES, capWords = 16, capChars = 130 } = {},
) {
  let units = sentences.map((s) => s.trim()).filter(Boolean)
  if (!units.length) return []

  // Always break oversized sentences so no single caption is a wall of text
  units = units.flatMap((s) => (wordCount(s) > 22 ? splitLongSentence(s, capWords) : [s]))

  // Too few scenes → split the longest remaining sentences at clause boundaries
  while (units.length < min) {
    let idx = -1
    let longest = 0
    for (let i = 0; i < units.length; i += 1) {
      const w = wordCount(units[i])
      if (w > longest && w > capWords) {
        longest = w
        idx = i
      }
    }
    if (idx < 0) break
    const pieces = splitLongSentence(units[idx], Math.ceil(wordCount(units[idx]) / 2))
    if (pieces.length < 2) break
    units.splice(idx, 1, ...pieces)
  }

  // Too many scenes → merge the shortest adjacent pair until within budget.
  // Never merge a pair whose combined length would blow the caption cap —
  // tidyCaption/normalizeEofScript truncate (and silently drop) anything past
  // that length, which was cutting whole sentences (including CTAs) out of the
  // narration. If no pair fits, stop merging rather than lose narration text —
  // a few extra scenes is far better than a truncated Short.
  while (units.length > max) {
    let idx = -1
    let smallest = Infinity
    for (let i = 0; i < units.length - 1; i += 1) {
      const merged = `${units[i]} ${units[i + 1]}`.replace(/\s+/g, ' ').trim()
      if (merged.length > capChars) continue
      const combined = wordCount(units[i]) + wordCount(units[i + 1])
      if (combined < smallest) {
        smallest = combined
        idx = i
      }
    }
    if (idx < 0) break
    units[idx] = `${units[idx]} ${units[idx + 1]}`.replace(/\s+/g, ' ').trim()
    units.splice(idx + 1, 1)
  }

  return units
}

function titleFromDraft(topic, draft) {
  const first = String(draft || '')
    .split(/[.!?]/)
    .map((s) => s.trim())
    .find(Boolean)
  if (first && first.length >= 12 && first.length <= 90) return first
  return String(topic || '').trim().slice(0, 90)
}

/**
 * Deterministic, faithful split of an approved plain-text draft into Short scenes.
 * Keeps the writer's words (no paraphrase, no dropped tail) and ties every image
 * query to the topic's player/club (Bellingham, Messi, …).
 * @param {{ plainTextDraft: string, topic: string, format?: string, forceMinScenes?: number }} input
 * `forceMinScenes` overrides the normal 3-scene floor — pass 1 for a guaranteed,
 * credit-free last-resort split of a manual/own script (even a single short
 * sentence becomes a valid one-scene Short instead of falling back to AI or a
 * generic template).
 */
export function adaptPlainTextDraftToScenesLocally({ plainTextDraft, topic, format = 'news', forceMinScenes } = {}) {
  const draft = String(plainTextDraft || '').trim()
  const t = String(topic || '').trim() || 'Football'
  const allowSingleSentence = Number.isFinite(forceMinScenes) && forceMinScenes <= 1
  const sentences = splitDraftIntoSentences(draft)
  if (!sentences.length) return null
  if (sentences.length < 2 && !allowSingleSentence) return null

  const target = targetSceneCountForDraft(draft)
  const min = Number.isFinite(forceMinScenes) && forceMinScenes > 0 ? Math.max(1, Math.floor(forceMinScenes)) : target.min
  const units = balanceSceneUnits(sentences, {
    min,
    max: Math.min(target.max, EOF_MAX_SCENES),
    capWords: 16,
  })
  const requiredMin = Number.isFinite(forceMinScenes) && forceMinScenes > 0 ? Math.max(1, Math.floor(forceMinScenes)) : 3
  if (units.length < requiredMin) return null

  const sceneCount = units.length
  const scenes = units.map((unit, i) => {
    const caption = tidyCaption(unit)
    return {
      caption,
      // Lead subject for most scenes; secondary (e.g. Tuchel) when the caption names them.
      imageQuery: defaultSceneImageQuery(t, i, {
        caption,
        plainTextDraft: draft,
        sceneCount,
      }),
      role: i === 0 ? 'hook' : i === units.length - 1 ? 'cta' : 'body',
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
