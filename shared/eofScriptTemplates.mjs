import { defaultSceneImageQuery } from './eofSceneImageQueries.mjs'

/** Browser + Node safe UUID (avoid node:crypto in client bundles). */
function newSceneId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `eof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Football Short formats — association football worldwide; never American football / NFL. */
export const EOF_SCRIPT_FORMATS = [
  {
    id: 'listicle',
    label: '5 facts listicle',
    detail: 'Hook → 3 football angles → closer. Best default for player topics.',
  },
  {
    id: 'hook_reveal',
    label: 'Hook & reveal',
    detail: 'Bold claim, build-up, twist, payoff, CTA — clubs, nations, World Cup, UCL.',
  },
  {
    id: 'debate',
    label: 'Hot take / debate',
    detail: 'Controversial football take with counterpoint and verdict.',
  },
  {
    id: 'timeline',
    label: 'Career timeline',
    detail: 'Origin → rise → peak → legacy → now (clubs, nations, tournaments).',
  },
  {
    id: 'news',
    label: 'Breaking news',
    detail:
      'Sky Sports / ESPN / ITV Sport style — transfer, match, injury, managerial, or World Cup news from football worldwide.',
  },
]

export const EOF_DEFAULT_SCRIPT_FORMAT = 'news'

export const EOF_MAX_SCENES = 8
export const EOF_MIN_SCENES = 1

/**
 * Association football worldwide (call it football — never “soccer” in scripts).
 * Includes World Cup 2026, all confederations, club + international.
 * Still never American football / NFL.
 */
export const EOF_FOOTBALL_SCOPE = `Association football (the beautiful game) WORLDWIDE — always call it football, never soccer.
Include: FIFA World Cup 2026 and all World Cups, continental tournaments (UEFA Euro, Copa América, AFCON, Asian Cup, Gold Cup), club football everywhere (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, MLS, Liga MX, Brasileirão, Argentine Primera, Saudi Pro League, A-League, J-League, etc.), UEFA Champions League / Europa / Conference, Copa Libertadores, and national teams from every confederation.
NEVER American football, NFL, NBA, MLB, NHL, or college football.`

/** @deprecated use EOF_FOOTBALL_SCOPE — kept so older imports keep working */
export const EOF_EUROPEAN_FOOTBALL_SCOPE = EOF_FOOTBALL_SCOPE

/**
 * Reading-time duration for on-screen captions (Shorts pace).
 * @param {string} caption
 */
export function estimateCaptionDurationSec(caption) {
  const words = String(caption || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  if (!words) return 3
  return Math.round(Math.min(6.5, Math.max(2.4, words / 2.2 + 0.9)) * 10) / 10
}

/**
 * Create or repair a scene. Preserves existing id when provided.
 * @param {{
 *   caption?: string,
 *   narration?: string,
 *   imageQuery?: string,
 *   role?: string,
 *   durationSec?: number,
 *   id?: string,
 * }} input
 */
export function createEofScene(input = {}) {
  const text = String(input.caption || input.narration || '').trim()
  const dur =
    input.durationSec != null && Number.isFinite(Number(input.durationSec))
      ? Number(input.durationSec)
      : estimateCaptionDurationSec(text)
  return {
    id: String(input.id || '').trim() || newSceneId(),
    narration: text,
    caption: text,
    imageQuery: String(input.imageQuery || '').trim(),
    role: input.role || 'body',
    durationSec: dur,
  }
}

/** @deprecated use createEofScene */
function scene(opts) {
  return createEofScene(opts)
}

function tagify(topic) {
  const first = String(topic || '')
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return ['football', 'shorts', 'shortsfeed', first].filter(Boolean)
}

function listicleScript(name) {
  const lines = [
    { role: 'hook', caption: `The ${name} detail most fans still miss`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `Breakthrough club years forged the first version of ${name}`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `Then the big-stage move changed how defenders faced ${name}`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Rivalries and pressure nights made the legend stick`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Best ${name} era — early club or peak years? Comment`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `5 things about ${name}`,
    description: `Quick visual facts about ${name}. Football Short. #Shorts #shortsfeed #football`,
    tags: tagify(name),
    format: 'listicle',
    scenes: lines.map((l) => createEofScene(l)),
  }
}

function hookRevealScript(name) {
  const lines = [
    { role: 'hook', caption: `${name} wasn’t built the way highlight reels pretend`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `Early seasons: learning the hard way under big pressure`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `One transfer / one role change flipped the whole story`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `After that, every rivalry night felt personal`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Was ${name} peak overrated or still underrated?`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `The real story of ${name}`,
    description: `Hook-to-reveal Short about ${name}. #Shorts #shortsfeed #football`,
    tags: tagify(name),
    format: 'hook_reveal',
    scenes: lines.map((l) => createEofScene(l)),
  }
}

function debateScript(name) {
  const lines = [
    { role: 'hook', caption: `Hot take: ${name} changed football more than the stats show`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `Critics: look at the numbers and the late-career drop`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `Fans: look at the eras, rivals, and nights that stuck`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Truth: influence is style + pressure, not one trophy list`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Team stats or team moments on ${name}? Pick a side`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `Hot take: ${name}`,
    description: `Debate-style Short about ${name}. #Shorts #shortsfeed #football`,
    tags: tagify(name),
    format: 'debate',
    scenes: lines.map((l) => createEofScene(l)),
  }
}

function timelineScript(name) {
  const lines = [
    { role: 'hook', caption: `${name} in 5 eras — not 5 empty compliments`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `Start: first club pressure and the first real role`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `Breakthrough: the season the world finally noticed`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Peak: big nights, rivalries, and the signature style`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Which ${name} chapter was the real peak? Comment`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `${name} career timeline`,
    description: `Visual timeline Short about ${name}. #Shorts #shortsfeed #football`,
    tags: tagify(name),
    format: 'timeline',
    scenes: lines.map((l) => createEofScene(l)),
  }
}

/** Sky Sports / ESPN / ITV Sport style breaking-news Short. */
function newsScript(topic) {
  const headline = String(topic || '').trim() || 'World Cup football news'
  const lines = [
    {
      role: 'hook',
      caption: `BREAKING: ${headline.slice(0, 80)}`,
      imageQuery: defaultSceneImageQuery(headline, 0),
    },
    {
      role: 'body',
      caption: `What we know so far — the key detail fans need`,
      imageQuery: defaultSceneImageQuery(headline, 1),
    },
    {
      role: 'body',
      caption: `Why it matters for the club, the league, and the table`,
      imageQuery: defaultSceneImageQuery(headline, 2),
    },
    {
      role: 'body',
      caption: `What happens next — the next 48 hours to watch`,
      imageQuery: defaultSceneImageQuery(headline, 3),
    },
    {
      role: 'cta',
      caption: `Good move or panic? Drop your take in the comments`,
      imageQuery: defaultSceneImageQuery(headline, 4),
    },
  ]
  return {
    topic: headline,
    title: headline.slice(0, 90),
    description: `${headline}. Eyes Of Football news Short. #Shorts #shortsfeed #football #transfernews`,
    tags: [...tagify(headline), 'transfernews', 'footballnews'].slice(0, 12),
    format: 'news',
    scenes: lines.map((l) => createEofScene(l)),
  }
}

/**
 * Build a Short script optimised for on-screen captions + stock images.
 * @param {string} topic
 * @param {{ format?: string }} [opts]
 */
export function buildFactsShortScript(topic, opts = {}) {
  const name = String(topic || '').trim() || 'This player'
  const format = String(opts.format || EOF_DEFAULT_SCRIPT_FORMAT).trim() || EOF_DEFAULT_SCRIPT_FORMAT

  switch (format) {
    case 'hook_reveal':
      return hookRevealScript(name)
    case 'debate':
      return debateScript(name)
    case 'timeline':
      return timelineScript(name)
    case 'news':
      return newsScript(name)
    case 'listicle':
    default:
      return listicleScript(name)
  }
}

/**
 * Normalize / repair a script after manual edits or AI output.
 * Preserves scene ids when present so Rebuild Short stays aligned.
 * @param {object} script
 * @param {string} [topicFallback]
 */
export function normalizeEofScript(script, topicFallback = '') {
  if (!script || typeof script !== 'object') return null
  const topic = String(script.topic || topicFallback || '').trim() || 'Football'
  const plainTextDraft = String(script.plainTextDraft || script.plain_text_draft || '').trim()
  const scenesIn = Array.isArray(script.scenes) ? script.scenes : []
  const scenes = scenesIn
    .map((s, i) => {
      const caption = String(s?.caption || s?.narration || s?.text || '').trim()
      if (!caption) return null
      const imageQuery = String(s?.imageQuery || s?.image_query || defaultSceneImageQuery(topic, i)).trim()
      return createEofScene({
        id: s?.id,
        caption: caption.slice(0, 140),
        imageQuery,
        role: s?.role || (i === 0 ? 'hook' : i === scenesIn.length - 1 ? 'cta' : 'body'),
        durationSec: s?.durationSec != null ? Number(s.durationSec) : undefined,
      })
    })
    .filter(Boolean)
    .slice(0, EOF_MAX_SCENES)

  const tags = Array.isArray(script.tags)
    ? script.tags.map(String).filter((t) => t.toLowerCase() !== 'soccer')
    : tagify(topic)
  const withShortsfeed = tags.includes('shortsfeed') ? tags : [...tags, 'shortsfeed']
  const format = String(script.format || EOF_DEFAULT_SCRIPT_FORMAT)

  // Draft-only scripts are valid before "Adapt to scenes"
  if (!scenes.length) {
    if (!plainTextDraft) return null
    return {
      topic,
      title: String(script.title || topic).trim().slice(0, 100),
      description: String(script.description || '').trim().slice(0, 500),
      tags: withShortsfeed.slice(0, 12),
      format,
      plainTextDraft,
      scenes: [],
    }
  }

  return {
    topic,
    title: String(script.title || `Short about ${topic}`).trim().slice(0, 100),
    description: String(
      script.description || `Visual Short about ${topic}. #Shorts #shortsfeed #football`,
    )
      .trim()
      .slice(0, 500),
    tags: withShortsfeed.slice(0, 12),
    format,
    plainTextDraft: plainTextDraft || undefined,
    scenes,
  }
}

/**
 * Pick music mood from topic keywords (legacy Music tab).
 * @param {string} topic
 */
export function inferMusicMoodFromTopic(topic) {
  const t = String(topic || '').toLowerCase()
  if (/goal|win|celebration|record|best|greatest|legend|breaking|transfer/.test(t)) return 'dramatic'
  if (/calm|story|history|legacy|career/.test(t)) return 'calm'
  if (/skills|trick|fun|viral/.test(t)) return 'upbeat'
  return 'neutral'
}
