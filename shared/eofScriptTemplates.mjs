import { randomUUID } from 'node:crypto'

const FACT_TEMPLATES = [
  (name) => `${name} is one of the most discussed names in modern football.`,
  (name) => `Fans still debate ${name}'s greatest seasons and what made them special.`,
  (name) => `From early breakthrough years to global stardom, ${name} changed how the game is seen.`,
  (name) => `Records, trophies, and iconic moments — ${name}'s story keeps growing.`,
  (name) => `Whether you love the stats or the highlights, ${name} always delivers a headline.`,
]

/**
 * Draft a Short script from a topic (player name or theme). Perplexity can replace this later.
 * @param {string} topic
 */
export function buildFactsShortScript(topic) {
  const name = String(topic || '').trim() || 'This player'
  const title = `5 things about ${name}`
  const scenes = FACT_TEMPLATES.map((fn, i) => {
    const narration = fn(name)
    const caption = narration.split(/[.!?]/)[0].slice(0, 72)
    return {
      id: randomUUID(),
      narration,
      caption: caption || `Fact ${i + 1}`,
      imageQuery: `${name} football`,
      durationSec: null,
    }
  })

  const description = `Quick facts about ${name}. #Shorts #football`
  return {
    topic: name,
    title,
    description,
    tags: ['football', 'shorts', name.split(/\s+/)[0]?.toLowerCase()].filter(Boolean),
    scenes,
  }
}

/**
 * Pick music mood from topic keywords (until AI scoring exists).
 * @param {string} topic
 */
export function inferMusicMoodFromTopic(topic) {
  const t = String(topic || '').toLowerCase()
  if (/goal|win|celebration|record|best|greatest|legend/.test(t)) return 'dramatic'
  if (/calm|story|history|legacy|career/.test(t)) return 'calm'
  if (/skills|trick|fun|viral/.test(t)) return 'upbeat'
  return 'neutral'
}
