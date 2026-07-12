/**
 * Scene image search queries for EOF Shorts.
 * Prefer topic-specific football photos (player/club/event) over generic stadium stock.
 */

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'from',
  'is',
  'was',
  'are',
  'were',
  'be',
  'been',
  'this',
  'that',
  'these',
  'those',
  'his',
  'her',
  'their',
  'its',
  'as',
  'by',
  'vs',
  'v',
  'after',
  'before',
  'about',
  'into',
  'over',
  'under',
  'new',
  'latest',
  'breaking',
  'news',
  'update',
  'says',
  'said',
])

/**
 * Pull searchable topic tokens (names, clubs, competitions).
 * @param {string} topic
 */
export function extractTopicImageTokens(topic) {
  const raw = String(topic || '')
    .replace(/[“”"']/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!raw) return []

  const words = raw.split(' ').filter(Boolean)
  const tokens = []
  // Keep multi-word proper-looking chunks (capitalized runs)
  let proper = []
  for (const w of words) {
    if (/^[A-Z]/.test(w) || /^[A-Z0-9-]{2,}$/.test(w)) {
      proper.push(w)
    } else if (proper.length) {
      tokens.push(proper.join(' '))
      proper = []
    }
  }
  if (proper.length) tokens.push(proper.join(' '))

  for (const w of words) {
    const low = w.toLowerCase()
    if (STOP.has(low) || low.length < 3) continue
    if (!tokens.some((t) => t.toLowerCase().includes(low))) tokens.push(w)
  }

  // Prefer longer / more specific first
  return [...new Set(tokens.map((t) => t.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  )
}

const SCENE_ANGLES = [
  (core) => `${core} football`,
  (core) => `${core} match`,
  (core) => `${core} celebrating`,
  (core) => `${core} press conference`,
  (core) => `${core} training`,
]

/**
 * Build ordered search queries — topic-specific first, generic last.
 * @param {{ topic?: string, imageQuery?: string, sceneIndex?: number }} input
 */
export function buildSceneImageSearchQueries({ topic, imageQuery, sceneIndex = 0 }) {
  const name = String(topic || '').trim()
  const custom = String(imageQuery || '').trim()
  const tokens = extractTopicImageTokens(name)
  const core = tokens.slice(0, 3).join(' ') || name || 'football'
  const year = new Date().getFullYear()
  const angle = SCENE_ANGLES[sceneIndex % SCENE_ANGLES.length](core)

  const queries = [
    custom,
    // Force recency bias in the query text for Pinterest / Google / AP
    `${core} ${year}`,
    `${core} latest`,
    angle,
    name && name !== core ? `${name} football ${year}` : '',
    tokens[0] ? `${tokens[0]} football player` : '',
    // Weak generics only as last resorts
    name ? `${name} football` : '',
  ]

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length > 2))]
}

/**
 * Score a candidate image title/description against the topic (higher = better).
 * @param {string} topic
 * @param {string} haystack
 */
export function scoreImageRelevance(topic, haystack) {
  const tokens = extractTopicImageTokens(topic).map((t) => t.toLowerCase())
  const hay = String(haystack || '').toLowerCase()
  if (!hay || !tokens.length) return 0
  let score = 0
  for (const t of tokens) {
    if (hay.includes(t.toLowerCase())) score += Math.min(8, t.length)
  }
  // Soft boost for football context; soft penalty for off-sport noise
  if (/\b(football|soccer|premier|liga|serie|bundesliga|champions|world cup|fifa)\b/i.test(hay)) {
    score += 3
  }
  if (/\b(nfl|nba|mlb|nhl|rugby|cricket|american football)\b/i.test(hay)) score -= 12
  return score
}

/**
 * Per-scene image search line for auto-generated scripts.
 * @param {string} topic
 * @param {number} sceneIndex
 */
export function defaultSceneImageQuery(topic, sceneIndex) {
  const name = String(topic || '').trim() || 'football'
  const tokens = extractTopicImageTokens(name)
  const core = tokens.slice(0, 2).join(' ') || name
  return SCENE_ANGLES[sceneIndex % SCENE_ANGLES.length](core)
}
