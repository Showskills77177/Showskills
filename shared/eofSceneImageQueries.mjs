/**
 * Scene image search queries for EOF Shorts.
 * Prefer topic-specific football photos (player/club/event/manager) over generic stadium stock.
 * Bias toward current year / “latest” and never treat coaches as “football player”.
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

/** Well-known managers/coaches — avoid “football player” image queries. */
const KNOWN_COACH_RE =
  /\b(tuchel|guardiola|klopp|mourinho|ancelotti|arteta|slot|postecoglou|ten\s*hag|conte|sarri|flick|nagelsmann|spalletti|deschamps|scaloni|southgate|xabi\s*alonso|alonso|de\s*zerbi|emery|roger[s]?|kompany|inzaghi|pirez|pirlo|lampard|gerrard|neville)\b/i

const COACH_ROLE_RE = /\b(manager|coach|gaffer|boss|head\s*coach)\b/i

/**
 * @param {string} topic
 */
export function topicLooksLikeCoach(topic) {
  const t = String(topic || '')
  return COACH_ROLE_RE.test(t) || KNOWN_COACH_RE.test(t)
}

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

const PLAYER_ANGLES = [
  (core) => `${core} football`,
  (core) => `${core} match`,
  (core) => `${core} celebrating`,
  (core) => `${core} press conference`,
  (core) => `${core} training`,
]

const COACH_ANGLES = [
  (core) => `${core} manager`,
  (core) => `${core} coach press conference`,
  (core) => `${core} sideline`,
  (core) => `${core} training ground`,
  (core) => `${core} England manager`,
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
  const coach = topicLooksLikeCoach(`${name} ${custom}`)
  const angles = coach ? COACH_ANGLES : PLAYER_ANGLES
  const angle = angles[sceneIndex % angles.length](core)
  const roleTag = coach ? 'manager' : 'football'

  const queries = [
    custom,
    // Force recency bias in the query text for AP / Google / Pinterest
    `${core} ${year}`,
    `${core} latest ${year}`,
    angle,
    coach ? `${core} football manager ${year}` : '',
    name && name !== core ? `${name} ${roleTag} ${year}` : '',
    tokens[0] ? `${tokens[0]} ${coach ? 'football manager' : 'football'}` : '',
    // Weak generics only as last resorts
    name ? `${name} football` : '',
  ]

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length > 2))]
}

/**
 * Score a candidate image title/description against the topic (higher = better).
 * Requires a real name/token hit — random stadiums and throwbacks score low.
 * @param {string} topic
 * @param {string} haystack
 */
export function scoreImageRelevance(topic, haystack) {
  const tokens = extractTopicImageTokens(topic).map((t) => t.toLowerCase())
  const hay = String(haystack || '').toLowerCase()
  if (!hay || !tokens.length) return 0
  let score = 0
  let strongHit = false
  for (const t of tokens) {
    if (!hay.includes(t)) continue
    score += Math.min(10, Math.max(4, t.length))
    if (t.length >= 5 || t.includes(' ')) strongHit = true
  }
  // Soft boost for football context; soft penalty for off-sport noise
  if (/\b(football|soccer|premier|liga|serie|bundesliga|champions|world cup|fifa|england|manager|coach)\b/i.test(hay)) {
    score += 3
  }
  if (topicLooksLikeCoach(topic) && /\b(manager|coach|sideline|press conference|england)\b/i.test(hay)) {
    score += 4
  }
  const year = new Date().getFullYear()
  if (hay.includes(String(year))) score += 6
  else if (hay.includes(String(year - 1))) score += 3
  // Throwback / archival noise
  if (/\b(throwback|archive|young|childhood|retro|199\d|200\d|201[0-8])\b/i.test(hay)) score -= 8
  if (/\b(nfl|nba|mlb|nhl|rugby|cricket|american football)\b/i.test(hay)) score -= 12
  // Person topics without a surname/name hit are useless stock
  if (!strongHit && tokens.some((t) => t.length >= 5 || t.includes(' '))) score -= 6
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
  const angles = topicLooksLikeCoach(name) ? COACH_ANGLES : PLAYER_ANGLES
  return angles[sceneIndex % angles.length](core)
}
