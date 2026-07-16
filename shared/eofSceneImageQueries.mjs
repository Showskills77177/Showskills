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
  /\b(messi|ronaldo|mbapp[eé]|haaland|salah|vinicius|bellingham|saka|foden|kane|lewa(ndowski)?|ney(mar)?|benzema|modric|de\s*bruyne|rodri|yamal|pedri|gavi|osimhen|lookman|palmer|rice|son|heung|lavelle|putellas|rooney|beckham|giggs|shearer|drogba|henry|torres|aguero|suarez|iniesta|xavi|zidane|ronaldinho|owen|gerrard|lampard|terry|ferdinand|scholes|neville|cole|ashley\s*cole)\b/i

/** Common football mononyms → full name (helps Wikimedia / Pexels / Google find the player). */
const PLAYER_FULL_NAMES = [
  [/^messi$/i, 'Lionel Messi'],
  [/^ronaldo$/i, 'Cristiano Ronaldo'],
  [/^mbapp/i, 'Kylian Mbappe'],
  [/^haaland$/i, 'Erling Haaland'],
  [/^bellingham$/i, 'Jude Bellingham'],
  [/^saka$/i, 'Bukayo Saka'],
  [/^foden$/i, 'Phil Foden'],
  [/^kane$/i, 'Harry Kane'],
  [/^salah$/i, 'Mohamed Salah'],
  [/^vinicius$/i, 'Vinicius Junior'],
  [/^yamal$/i, 'Lamine Yamal'],
  [/^pedri$/i, 'Pedri Gonzalez'],
  [/^gavi$/i, 'Gavi Barcelona'],
  [/^rodri$/i, 'Rodri Manchester City'],
  [/^rice$/i, 'Declan Rice'],
  [/^palmer$/i, 'Cole Palmer'],
  [/^modric$/i, 'Luka Modric'],
  [/^benzema$/i, 'Karim Benzema'],
  [/^neymar$/i, 'Neymar Jr'],
  [/^lewandowski$/i, 'Robert Lewandowski'],
  [/^osimhen$/i, 'Victor Osimhen'],
  [/^lookman$/i, 'Ademola Lookman'],
  [/^son$/i, 'Son Heung-min'],
  [/^rooney$/i, 'Wayne Rooney'],
  [/^beckham$/i, 'David Beckham'],
  [/^giggs$/i, 'Ryan Giggs'],
  [/^shearer$/i, 'Alan Shearer'],
  [/^drogba$/i, 'Didier Drogba'],
  [/^henry$/i, 'Thierry Henry'],
  [/^torres$/i, 'Fernando Torres'],
  [/^aguero$/i, 'Sergio Aguero'],
  [/^suarez$/i, 'Luis Suarez'],
  [/^iniesta$/i, 'Andres Iniesta'],
  [/^xavi$/i, 'Xavi Hernandez'],
  [/^zidane$/i, 'Zinedine Zidane'],
  [/^ronaldinho$/i, 'Ronaldinho'],
  [/^owen$/i, 'Michael Owen'],
  [/^gerrard$/i, 'Steven Gerrard'],
  [/^lampard$/i, 'Frank Lampard'],
  [/^tuchel$/i, 'Thomas Tuchel'],
  [/^guardiola$/i, 'Pep Guardiola'],
  [/^klopp$/i, 'Jurgen Klopp'],
  [/^arteta$/i, 'Mikel Arteta'],
  [/^mourinho$/i, 'Jose Mourinho'],
  [/^ancelotti$/i, 'Carlo Ancelotti'],
  [/^nagelsmann$/i, 'Julian Nagelsmann'],
  [/^southgate$/i, 'Gareth Southgate'],
]

/**
 * @param {string} lead
 * @returns {string}
 */
export function expandPlayerFullName(lead) {
  const l = String(lead || '').trim()
  for (const [re, full] of PLAYER_FULL_NAMES) {
    if (re.test(l)) return full
  }
  return ''
}

const COMP_WORD_RE =
  /^(world|cup|champions|league|premier|liga|serie|bundesliga|ligue|euro|euros|copa|america|américa|nations|fifa|uefa|afcon|final|finals|qualifier|qualifiers|group|match|game|news|latest|breaking|update)$/i

/**
 * Expand a multi-word entity to a known full name when any token matches.
 * @param {string} entity
 * @returns {string}
 */
function expandEntityFullName(entity) {
  const e = String(entity || '').trim()
  if (!e) return ''
  for (const w of e.split(/\s+/)) {
    const full = expandPlayerFullName(w)
    if (full) return full
  }
  if (KNOWN_PLAYER_RE.test(e) || KNOWN_COACH_RE.test(e)) {
    return e
      .split(/\s+/)
      .filter((w) => !COMP_WORD_RE.test(w) && !NAME_BREAK_RE.test(w))
      .join(' ')
      .trim()
  }
  return ''
}

/**
 * The single best image subject for a topic — a known player/coach full name when possible,
 * with competition noise (World Cup, Champions League, …) stripped so photo search stays on the person.
 * When two stars appear (Rooney on Ronaldo), prefer the name that appears first in the topic —
 * not whichever mononym ranks higher in the entity sort.
 * @param {string} topic
 * @returns {string}
 */
export function resolveImageSubject(topic) {
  const cleaned = sanitizeTopicForImageSearch(topic)
  const entities = primaryImageEntities(cleaned)
  const hay = cleaned.toLowerCase()

  /** @type {{ full: string, at: number }[]} */
  const named = []
  for (const e of entities) {
    const full = expandEntityFullName(e)
    if (!full) continue
    const needle = String(e).toLowerCase()
    let at = hay.indexOf(needle)
    if (at < 0) {
      // Fall back to first token position (e.g. entity "Ronaldo" in "Rooney on Ronaldo")
      const firstTok = needle.split(/\s+/)[0] || needle
      at = hay.indexOf(firstTok)
    }
    if (at < 0) at = 9999
    named.push({ full, at })
  }
  named.sort((a, b) => a.at - b.at || b.full.length - a.full.length)
  if (named[0]?.full) return named[0].full

  const first = entities[0] || cleaned || String(topic || '').trim()
  const cleanedEnt = first
    .split(/\s+/)
    .filter((w) => !COMP_WORD_RE.test(w) && !NAME_BREAK_RE.test(w))
    .join(' ')
    .trim()
  return cleanedEnt || first || 'football'
}

/**
 * @param {string} topic
 */
export function topicLooksLikeCoach(topic) {
  const t = String(topic || '')
  return COACH_ROLE_RE.test(t) || KNOWN_COACH_RE.test(t)
}

/** Sentence/dialogue words that must never glue onto a person name ("Thomas Tuchel We"). */
const NAME_BREAK_RE =
  /^(we|i|you|they|he|she|it|this|that|these|those|what|when|where|why|how|who|whom|whose|were|was|are|is|am|been|being|have|has|had|do|does|did|will|would|can|could|should|may|might|must|not|no|yes|ok|okay|sloppy|enough|fast|slow|good|bad|very|really|just|also|then|than|too|so|if|or|but|and|the|a|an)$/i

/**
 * Strip headline dialogue / quote tails so image search keys off the person, not the soundbite.
 * e.g. `Thomas Tuchel: "We were sloppy…"` → `Thomas Tuchel`
 * @param {string} topic
 */
export function sanitizeTopicForImageSearch(topic) {
  let t = String(topic || '')
  // Remove quoted dialogue entirely (straight + curly quotes)
  t = t.replace(/[\u201C\u201D"']([^\"\u201C\u201D']*)[\u201C\u201D"']/g, ' ')
  // Drop trailing subtitle after colon/dash once quotes are gone
  t = t.replace(/\s*[:\u2013\u2014\-]\s*.*$/u, ' ')
  t = t.replace(/[^\p{L}\p{N}\s-]/gu, ' ')
  return t.replace(/\s+/g, ' ').trim()
}

/**
 * Pull searchable topic tokens (names, clubs, competitions).
 * Person / club names rank above “World Cup” / fluff verbs.
 * @param {string} topic
 */
export function extractTopicImageTokens(topic) {
  const raw = sanitizeTopicForImageSearch(topic)
  if (!raw) return []

  const words = raw.split(' ').filter(Boolean)
  const tokens = []
  let proper = []
  const flushProper = () => {
    if (!proper.length) return
    // Drop trailing sentence words accidentally capitalized after a colon/quote strip
    while (proper.length && NAME_BREAK_RE.test(proper[proper.length - 1])) proper.pop()
    // If a break word sat in the middle ("Thomas We Tuchel"), keep only the leading name chunk
    const breakAt = proper.findIndex((w, i) => i > 0 && NAME_BREAK_RE.test(w))
    const chunk = breakAt >= 0 ? proper.slice(0, breakAt) : proper
    if (chunk.length) tokens.push(chunk.join(' '))
    proper = []
  }

  for (const w of words) {
    // Capitalized words + acronyms (PSG, USA) are proper-noun runs — but NOT pure numbers/years
    // (e.g. "2026"), which must never be glued onto a name like "Thomas Tuchel 2026".
    const isProper = /^[A-Z]/.test(w) || (/^[A-Z0-9-]{2,}$/.test(w) && /[A-Z]/.test(w))
    if (isProper && !NAME_BREAK_RE.test(w)) {
      proper.push(w)
    } else if (isProper && NAME_BREAK_RE.test(w)) {
      flushProper()
    } else if (proper.length) {
      flushProper()
    }
  }
  flushProper()

  for (const w of words) {
    const low = w.toLowerCase()
    if (STOP.has(low) || NAME_BREAK_RE.test(low) || low.length < 3) continue
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
  // Don't concatenate identical topic+query into "Thomas Tuchel Thomas Tuchel" —
  // that becomes a required entity no real photo title will ever contain.
  const topicStr = sanitizeTopicForImageSearch(topic)
  const queryStr = sanitizeTopicForImageSearch(imageQuery)
  const blob =
    !queryStr || queryStr.toLowerCase() === topicStr.toLowerCase()
      ? topicStr
      : topicStr.toLowerCase().includes(queryStr.toLowerCase())
        ? topicStr
        : queryStr.toLowerCase().includes(topicStr.toLowerCase())
          ? queryStr
          : `${topicStr} ${queryStr}`.trim()
  const tokens = extractTopicImageTokens(blob)
  const entities = tokens.filter((t) => {
    if (COMP_NOISE_RE.test(t)) return false
    if (/^\d{4}$/.test(t)) return false
    if (STOP.has(t.toLowerCase())) return false
    if (NAME_BREAK_RE.test(t)) return false
    return t.length >= 4 || KNOWN_PLAYER_RE.test(t) || KNOWN_COACH_RE.test(t)
  })
  // Collapse accidental duplicated names ("Thomas Tuchel Thomas Tuchel")
  const cleaned = entities.map((e) => {
    const parts = e.split(/\s+/).filter(Boolean)
    const half = Math.floor(parts.length / 2)
    if (
      half >= 2 &&
      parts.length === half * 2 &&
      parts.slice(0, half).join(' ').toLowerCase() === parts.slice(half).join(' ').toLowerCase()
    ) {
      return parts.slice(0, half).join(' ')
    }
    return e
  })
  return cleaned.length ? cleaned.slice(0, 4) : tokens.slice(0, 2)
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
  const fullName = expandPlayerFullName(lead)

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
  if (hay.includes(String(year))) score += 8
  else if (hay.includes(String(year - 1))) score += 5
  // Prefer current stills for active coaches/stories, but keep career match photos for
  // named players (Rooney / Beckham / Henry — best Google hits are often 2000s–2010s).
  const namedStarHit = mustHit.some((t) => hay.includes(t.toLowerCase()))
  const softLegacyYears = namedStarHit && !topicLooksLikeCoach(topic)
  if (/\b(throwback|archive|young|childhood|retro)\b/i.test(hay)) score -= softLegacyYears ? 4 : 14
  else if (/\b(199\d|200\d|201[0-6])\b/i.test(hay)) score -= softLegacyYears ? 2 : 14
  else if (/\b(201[7-9])\b/i.test(hay) && !softLegacyYears) score -= 8
  if (/\b(nfl|nba|mlb|nhl|rugby|cricket|american football)\b/i.test(hay)) score -= 12
  // Generic World Cup / stadium with no person hit already rejected above
  if (COMP_NOISE_RE.test(hay) && !strongHit) score -= 10
  if (!strongHit && tokens.some((t) => t.length >= 5 || t.includes(' '))) score -= 6
  return score
}

/**
 * Caption → photo angle so scene stills match the beat (tactics, England, celebration…).
 * @param {string} caption
 * @param {string} subject
 * @param {boolean} coach
 */
export function imageAngleFromCaption(caption, subject, coach = false) {
  const core = String(subject || '').trim() || 'football'
  const c = String(caption || '').toLowerCase()
  if (/\btactic|formation|system|shape|press(ing)?\b/.test(c)) {
    return coach ? `${core} tactics board` : `${core} football tactics`
  }
  if (/\bengland\b/.test(c) && coach) return `${core} England manager`
  if (/\bpress|interview|says|said|quotes?\b/.test(c)) return `${core} press conference`
  if (/\btrain|session|drill\b/.test(c)) return `${core} training`
  if (/\bcelebrat|goal|scores?|winner\b/.test(c)) return `${core} celebrating football`
  if (/\bsideline|touchline|bench\b/.test(c)) return `${core} sideline`
  if (/\bmatch|game|derby|final\b/.test(c)) return `${core} match football`
  return coach ? `${core} manager` : `${core} football`
}

/**
 * Per-scene image search line for auto-generated scripts.
 * @param {string} topic
 * @param {number} sceneIndex
 */
export function defaultSceneImageQuery(topic, sceneIndex) {
  const name = String(topic || '').trim() || 'football'
  // Anchor every scene to the topic's player/club (expanded full name), never caption noise
  const core = resolveImageSubject(name) || name
  const angles = topicLooksLikeCoach(name) ? COACH_ANGLES : PLAYER_ANGLES
  return angles[sceneIndex % angles.length](core)
}

/**
 * Ensure AI / adapted imageQuery still names the lead subject and matches the caption beat.
 * @param {{ topic?: string, imageQuery?: string, caption?: string, sceneIndex?: number }} input
 */
export function anchorSceneImageQuery({ topic, imageQuery, caption, sceneIndex = 0 } = {}) {
  const subject = resolveImageSubject(topic || '') || String(topic || 'football').trim()
  const coach = topicLooksLikeCoach(`${topic || ''} ${caption || ''}`)
  const raw = String(imageQuery || '').trim()
  const surname = subject.split(/\s+/).filter(Boolean).pop() || subject
  const namesSubject =
    raw &&
    (new RegExp(subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(raw) ||
      (surname.length >= 4 && new RegExp(`\\b${surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(raw)))

  if (namesSubject && !/^(stadium|crowd|fans?|generic)\b/i.test(raw)) {
    // Keep AI angle when it already names the person; lightly enrich with caption cues.
    if (caption && /\btactic|england|celebrat|press|train/i.test(caption) && !/\btactic|england|celebrat|press|train/i.test(raw)) {
      return imageAngleFromCaption(caption, subject, coach)
    }
    return raw
  }
  if (caption) return imageAngleFromCaption(caption, subject, coach)
  return defaultSceneImageQuery(topic || subject, sceneIndex)
}
