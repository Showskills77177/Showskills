const SCENE_IMAGE_THEMES = [
  (name) => `${name} football player action`,
  (name) => `${name} celebrating goal`,
  (name) => `${name} football stadium`,
  (name) => `${name} football portrait`,
  (name) => `${name} match highlights`,
]

/**
 * Build Pexels search queries for a scene (tries in order until one hits).
 * @param {{ topic?: string, imageQuery?: string, sceneIndex?: number }} input
 */
export function buildSceneImageSearchQueries({ topic, imageQuery, sceneIndex = 0 }) {
  const name = String(topic || '').trim()
  const custom = String(imageQuery || '').trim()
  const themed = name ? SCENE_IMAGE_THEMES[sceneIndex % SCENE_IMAGE_THEMES.length](name) : ''
  const queries = [
    custom,
    themed,
    name ? `${name} football` : '',
    'football player stadium',
    'football match crowd',
  ]
  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length > 1))]
}

/**
 * Per-scene image search line for auto-generated scripts.
 * @param {string} topic
 * @param {number} sceneIndex
 */
export function defaultSceneImageQuery(topic, sceneIndex) {
  const name = String(topic || '').trim() || 'football'
  return SCENE_IMAGE_THEMES[sceneIndex % SCENE_IMAGE_THEMES.length](name)
}
