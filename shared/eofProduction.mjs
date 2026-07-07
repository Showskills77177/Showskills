/** Eyes Of Football — automated production pipeline (staging). */

export const EOF_PRODUCTION_JOB_STATUS = {
  DRAFT: 'draft',
  SCRIPTING: 'scripting',
  READY_SCRIPT: 'ready_script',
  RENDERING: 'rendering',
  RENDERED: 'rendered',
  FAILED: 'failed',
  PUBLISHED: 'published',
}

export const EOF_VOICE_PRESETS = {
  british: {
    id: 'british',
    label: 'British narrator',
    engine: 'edge',
    voice: 'en-GB-RyanNeural',
    rate: '-8%',
  },
  british_calm: {
    id: 'british_calm',
    label: 'British (slower)',
    engine: 'edge',
    voice: 'en-GB-ThomasNeural',
    rate: '-12%',
  },
}

export const EOF_MUSIC_MOODS = [
  { id: 'neutral', label: 'Neutral / general' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'upbeat', label: 'Upbeat' },
  { id: 'calm', label: 'Calm' },
]

/** Default music bed level under narration (0–1). */
export const EOF_DEFAULT_MUSIC_VOLUME = 0.22

export const EOF_MUSIC_SOURCE_YOUTUBE_LIBRARY = 'youtube_audio_library'

/**
 * @typedef {object} EofScriptScene
 * @property {string} id
 * @property {string} narration
 * @property {string} caption
 * @property {string} imageQuery
 * @property {number} [durationSec]
 */

/**
 * @typedef {object} EofProductionScript
 * @property {string} topic
 * @property {string} title
 * @property {string} description
 * @property {string[]} tags
 * @property {EofScriptScene[]} scenes
 */

export function parseProductionScript(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function productionJobStatusLabel(status) {
  const map = {
    draft: 'Draft',
    scripting: 'Writing script…',
    ready_script: 'Script ready',
    rendering: 'Rendering…',
    rendered: 'Audio rendered',
    failed: 'Failed',
    published: 'Published',
  }
  return map[status] || status || '—'
}
