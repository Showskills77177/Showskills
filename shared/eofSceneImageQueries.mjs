/**
 * Scene image search queries for EOF Shorts.
 * Prefer the PERSON / club named in the topic (Messi, Tuchel, …) — never generic World Cup stock.
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
  'shines',
  'shine',
  'wins',
  'win',
  'beats',
  'beat',
  'against',
  'during',
  'while',
  'when',
  'what',
  'who',
  'how',
  'why',
])

/** Competition / event noise — never let these outrank the player name in search. */
const COMP_NOISE_RE =
  /\b(world\s*cup|champions\s*league|premier\s*league|la\s*liga|serie\s*a|bundesliga|ligue\s*1|euros?|copa\s*america|nations\s*league|fifa|uefa|finals?|qualifier|qualifiers)\b/i

/** Well-known managers/coaches — avoid “football player” image queries. */
const KNOWN_COACH_RE =
  /\b(tuchel|guardiola|klopp|mourinho|ancelotti|arteta|slot|postecoglou|ten\s*hag|conte|sarri|flick|nagelsmann|spalletti|deschamps|scaloni|southgate|xabi\s*alonso|alonso|de\s*zerbi|emery|roger[s]?|kompany|inzaghi|pirez|pirlo|lampard|gerrard|neville)\b/i

const COACH_ROLE_RE = /\b(manager|coach|gaffer|boss|head\s*coach)\b/i

/** High-signal football surnames / mononyms for hard entity matching. */
const KNOWN_PLAYER_RE =
  /\b(messi|ronaldo|mbapp[eé]|haaland|salah|vinicius|bellingham|saka|foden|kane|lewa(ndowski)?|ney(mar)?|benzema|modric|de\s*bruyne|rodri|yamal|pedri|gavi|osimhen|lookman|palmer|rice|son|heung|lavelle|putellas)\b/i

/**
 * @param {string} topic
 */
export function topicLooksLikeCoach(topic) {
  const t = String(topic || '')
  return COACH_ROLE_RE.test(t) || KNOWN_COACH_RE.test(t)
}

/**
 * Pull searchable topic tokens (names, clubs, competitions).
 * Person / club names rank above “World Cup” / fluff verbs.
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

  const uniq = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))]
  // Rank: known players/coaches → multi-word proper names → other → competition noise last
  return uniq.sort((a, b) => entityRank(b) - entityRank(a) || b.length - a.length || a.localeCompare(b))
}

function entityRank(token) {
  const t = String(token || '')
  const low = t.toLowerCase()
  if (KNOWN_PLAYER_RE.test(low) || KNOWN_COACH_RE.test(low)) return 100
  if (COMP_NOISE_RE.test(t)) return 10
  if (STOP.has(low)) return 0
  if (t.includes(' ') && /^[A-Z]/.test(t)) return 80
  if (/^[A-Z]/.test(t) && t.length >= 4) return 70
  if (/^\d{4}$/.test(t)) return 15
  return 40
}

/**
 * Primary people/clubs that MUST appear in an image title for a match.
 * @param {string} topic
 * @param {string} [imageQuery]
 */
export function primaryImageEntities(topic, imageQuery = '') {
  const blob = `${topic || ''} ${imageQuery || ''}`.trim()
  const tokens = extractTopicImageTokens(blob)
  const entities = tokens.filter((t) => {
    if (COMP_NOISE_RE.test(t)) return false
    if (/^\d{4}$/.test(t)) return false
    if (STOP.has(t.toLowerCase())) return false
    return t.length >= 4 || KNOWN_PLAYER_RE.test(t) || KNOWN_COACH_RE.test(t)
  })
  return entities.length ? entities.slice(0, 4) : tokens.slice(0, 2)
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
 * Build ordered search queries — person/club first, competition never alone.
 * @param {{ topic?: string, imageQuery?: string, sceneIndex?: number }} input
 */
export function buildSceneImageSearchQueries({ topic, imageQuery, sceneIndex = 0 }) {
  const name = String(topic || '').trim()
  const custom = String(imageQuery || '').trim()
  const entities = primaryImageEntities(name, custom)
  const core = entities.slice(0, 2).join(' ') || extractTopicImageTokens(name).slice(0, 2).join(' ') || name || 'football'
  const year = new Date().getFullYear()
  const coach = topicLooksLikeCoach(`${name} ${custom}`)
  const angles = coach ? COACH_ANGLES : PLAYER_ANGLES
  const angle = angles[sceneIndex % angles.length](core)
  const roleTag = coach ? 'manager' : 'football'
  const lead = entities[0] || core

  /** Expand mononyms that stock APIs understand better as full names. */
  const fullName =
    /^messi$/i.test(lead)
      ? 'Lionel Messi'
      : /^ronaldo$/i.test(lead)
        ? 'Cristiano Ronaldo'
        : /^mbapp/i.test(lead)
          ? 'Kylian Mbappe'
          : /^haaland$/i.test(lead)
            ? 'Erling Haaland'
            : ''

  const queries = [
    // Prefer the scene’s own imageQuery when it already names the person/club
    custom && entities.some((e) => new RegExp(e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(custom))
      ? custom
      : '',
    fullName ? `${fullName} football` : '',
    `${lead} football`,
    `${core} football`,
    `${lead} ${year}`,
    `${lead} latest ${year}`,
    fullName ? `${fullName} ${year}` : '',
    angle,
    coach ? `${core} football manager ${year}` : `${lead} celebrating football`,
    name && !COMP_NOISE_RE.test(name) ? `${name} ${roleTag}` : '',
    /world\s*cup/i.test(`${name} ${custom}`) ? `${fullName || lead} World Cup football` : '',
    custom,
  ]

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length > 2))]
}

/**
 * Score a candidate image title/description against the topic (higher = better).
 * Hard-rejects images that don't mention the primary person/club (e.g. Messi topic → no Messi in title).
 * @param {string} topic
 * @param {string} haystack
 * @param {string} [imageQuery]
 */
export function scoreImageRelevance(topic, haystack, imageQuery = '') {
  const hay = String(haystack || '').toLowerCase()
  if (!hay) return 0

  const required = primaryImageEntities(topic, imageQuery)
  const mustHit = required.filter((t) => t.length >= 4 || KNOWN_PLAYER_RE.test(t) || KNOWN_COACH_RE.test(t))
  if (mustHit.length) {
    const hit = mustHit.some((t) => hay.includes(t.toLowerCase()))
    if (!hit) return -25
  }

  const tokens = extractTopicImageTokens(`${topic || ''} ${imageQuery || ''}`).map((t) => t.toLowerCase())
  if (!tokens.length) return 0

  let score = 0
  let strongHit = false
  for (const t of tokens) {
    if (!hay.includes(t)) continue
    score += Math.min(12, Math.max(4, t.length))
    if (t.length >= 5 || t.includes(' ') || KNOWN_PLAYER_RE.test(t)) strongHit = true
  }
  if (/\b(football|soccer|premier|liga|serie|bundesliga|champions|world cup|fifa|england|manager|coach|argentina|barcelona|psg|inter miami)\b/i.test(hay)) {
    score += 3
  }
  if (topicLooksLikeCoach(topic) && /\b(manager|coach|sideline|press conference|england)\b/i.test(hay)) {
    score += 4
  }
  const year = new Date().getFullYear()
  if (hay.includes(String(year))) score += 6
  else if (hay.includes(String(year - 1))) score += 3
  if (/\b(throwback|archive|young|childhood|retro|199\d|200\d|201[0-8])\b/i.test(hay)) score -= 8
  if (/\b(nfl|nba|mlb|nhl|rugby|cricket|american football)\b/i.test(hay)) score -= 12
  // Generic World Cup / stadium with no person hit already rejected above
  if (COMP_NOISE_RE.test(hay) && !strongHit) score -= 10
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
  const entities = primaryImageEntities(name)
  const core = entities.slice(0, 2).join(' ') || name
  const angles = topicLooksLikeCoach(name) ? COACH_ANGLES : PLAYER_ANGLES
  return angles[sceneIndex % angles.length](core)
}
