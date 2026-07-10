import { randomUUID } from 'node:crypto'

import { defaultSceneImageQuery } from './eofSceneImageQueries.mjs'

/** Short formats for image + on-screen text videos (no voiceover). */
export const EOF_SCRIPT_FORMATS = [
  {
    id: 'listicle',
    label: '5 facts listicle',
    detail: 'Hook → 3 facts → closer. Best default for player topics.',
  },
  {
    id: 'hook_reveal',
    label: 'Hook & reveal',
    detail: 'Bold claim, build-up, twist, payoff, CTA.',
  },
  {
    id: 'debate',
    label: 'Hot take / debate',
    detail: 'Controversial take with counterpoint and verdict.',
  },
  {
    id: 'timeline',
    label: 'Career timeline',
    detail: 'Origin → rise → peak → legacy → now.',
  },
]

export const EOF_DEFAULT_SCRIPT_FORMAT = 'listicle'

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
  // ~2.2 words/sec on mobile + beat before cut
  return Math.round(Math.min(6.5, Math.max(2.4, words / 2.2 + 0.9)) * 10) / 10
}

function scene({ caption, imageQuery, role, durationSec }) {
  const text = String(caption || '').trim()
  const dur = durationSec ?? estimateCaptionDurationSec(text)
  return {
    id: randomUUID(),
    /** On-screen text is the product; keep narration in sync for older rows. */
    narration: text,
    caption: text,
    imageQuery: String(imageQuery || '').trim(),
    role: role || 'body',
    durationSec: dur,
  }
}

function tagify(topic) {
  const first = String(topic || '')
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return ['football', 'shorts', 'soccer', first].filter(Boolean)
}

function listicleScript(name) {
  const lines = [
    { role: 'hook', caption: `Stop scrolling — ${name} facts you never knew`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `${name} rewrote what “elite” looks like on the pitch`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `From breakthrough seasons to global superstar energy`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Records, trophies, and moments fans still argue about`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Which ${name} moment is #1? Comment below`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `5 things about ${name}`,
    description: `Quick visual facts about ${name}. Built for YouTube Shorts. #Shorts #football`,
    tags: tagify(name),
    format: 'listicle',
    scenes: lines.map((l) => scene(l)),
  }
}

function hookRevealScript(name) {
  const lines = [
    { role: 'hook', caption: `Everyone talks about ${name}… but this is the real story`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `The early years looked nothing like the legend we know`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `Then one season flipped the entire narrative`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Pressure, rivals, and nights that built a dynasty`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Save this if ${name} is still underrated`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `The real story of ${name}`,
    description: `Hook-to-reveal Short about ${name}. #Shorts #football`,
    tags: tagify(name),
    format: 'hook_reveal',
    scenes: lines.map((l) => scene(l)),
  }
}

function debateScript(name) {
  const lines = [
    { role: 'hook', caption: `Hot take: ${name} is more influential than the stats say`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `Critics point at the numbers. Fans point at the moments`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `Head-to-head eras make every comparison unfair`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Influence isn’t only trophies — it’s how the game feels`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Agree or disagree? Drop your take on ${name}`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `Hot take: ${name}`,
    description: `Debate-style Short about ${name}. #Shorts #football`,
    tags: tagify(name),
    format: 'debate',
    scenes: lines.map((l) => scene(l)),
  }
}

function timelineScript(name) {
  const lines = [
    { role: 'hook', caption: `${name}: a career in 5 slides`, imageQuery: defaultSceneImageQuery(name, 0) },
    { role: 'body', caption: `Start: raw talent, big club pressure, early lessons`, imageQuery: defaultSceneImageQuery(name, 1) },
    { role: 'body', caption: `Rise: breakout seasons and a style the world copied`, imageQuery: defaultSceneImageQuery(name, 2) },
    { role: 'body', caption: `Peak: trophies, records, unforgettable nights`, imageQuery: defaultSceneImageQuery(name, 3) },
    { role: 'cta', caption: `Legacy: still shaping debates years later`, imageQuery: defaultSceneImageQuery(name, 4) },
  ]
  return {
    topic: name,
    title: `${name} career timeline`,
    description: `Visual timeline Short about ${name}. #Shorts #football`,
    tags: tagify(name),
    format: 'timeline',
    scenes: lines.map((l) => scene(l)),
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
    case 'listicle':
    default:
      return listicleScript(name)
  }
}

/**
 * Normalize / repair a script after manual edits or AI output.
 * @param {object} script
 * @param {string} [topicFallback]
 */
export function normalizeEofScript(script, topicFallback = '') {
  if (!script || typeof script !== 'object') return null
  const topic = String(script.topic || topicFallback || '').trim() || 'Football'
  const scenesIn = Array.isArray(script.scenes) ? script.scenes : []
  const scenes = scenesIn
    .map((s, i) => {
      const caption = String(s?.caption || s?.narration || s?.text || '').trim()
      if (!caption) return null
      const imageQuery = String(s?.imageQuery || s?.image_query || defaultSceneImageQuery(topic, i)).trim()
      return scene({
        caption: caption.slice(0, 140),
        imageQuery,
        role: s?.role || (i === 0 ? 'hook' : i === scenesIn.length - 1 ? 'cta' : 'body'),
        durationSec: s?.durationSec != null ? Number(s.durationSec) : undefined,
      })
    })
    .filter(Boolean)

  if (!scenes.length) return null

  return {
    topic,
    title: String(script.title || `Short about ${topic}`).trim().slice(0, 100),
    description: String(script.description || `Visual Short about ${topic}. #Shorts #football`).trim().slice(0, 500),
    tags: Array.isArray(script.tags) ? script.tags.map(String).slice(0, 12) : tagify(topic),
    format: String(script.format || EOF_DEFAULT_SCRIPT_FORMAT),
    scenes,
  }
}

/**
 * Pick music mood from topic keywords (legacy Music tab).
 * @param {string} topic
 */
export function inferMusicMoodFromTopic(topic) {
  const t = String(topic || '').toLowerCase()
  if (/goal|win|celebration|record|best|greatest|legend/.test(t)) return 'dramatic'
  if (/calm|story|history|legacy|career/.test(t)) return 'calm'
  if (/skills|trick|fun|viral/.test(t)) return 'upbeat'
  return 'neutral'
}
