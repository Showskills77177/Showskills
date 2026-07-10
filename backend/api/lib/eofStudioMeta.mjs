/**
 * Studio metadata for EOF Shorts — title, description, hashtags, thumbnail scene.
 * Always includes #shortsfeed. Uses Grok 4.5 when available.
 */
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'
import { isXaiConfigured, xaiJsonCompletion } from './eofXaiClient.mjs'

export const EOF_REQUIRED_HASHTAG = 'shortsfeed'

/**
 * @param {{
 *   topic: string,
 *   script?: { title?: string, description?: string, tags?: string[], scenes?: Array<{ caption?: string }> } | null,
 *   format?: string,
 * }} input
 */
export async function composeEofStudioMeta(input) {
  const topic = String(input.topic || input.script?.title || 'football').trim()
  const format = String(input.format || input.script?.format || 'news')
  const captions = (input.script?.scenes || []).map((s) => s.caption).filter(Boolean).slice(0, 8)

  if (isXaiConfigured()) {
    try {
      const parsed = await xaiJsonCompletion({
        temperature: 0.35,
        system: `You write YouTube Shorts packaging for Eyes Of Football.

${EOF_FOOTBALL_SCOPE}

Rules:
- Title max 90 chars, scroll-stopping, no clickbait lies.
- Description 1–2 short lines + hashtags.
- Always say football — never soccer.
- tags: 8–12 items, lowercase, no # prefix.
- ALWAYS include the tag "shortsfeed".
- Also include "shorts" and "football".
- Never NFL / American football tags or the word soccer.
- thumbnailSceneIndex: 0-based index of the best scene for a custom thumbnail (usually the hook).`,
        user: `Topic: ${topic}
Format: ${format}
Existing title: ${input.script?.title || ''}
Captions:
${captions.map((c, i) => `${i + 1}. ${c}`).join('\n') || '(none)'}

Return JSON:
{
  "title": string,
  "description": string,
  "tags": string[],
  "thumbnailSceneIndex": number,
  "hashtagsLine": string
}`,
      })

      return normalizeStudioMeta(parsed, input.script, topic)
    } catch (e) {
      console.warn('[eof-studio-meta] Grok failed', e instanceof Error ? e.message : e)
    }
  }

  return normalizeStudioMeta(null, input.script, topic)
}

function normalizeStudioMeta(parsed, script, topic) {
  const title = String(parsed?.title || script?.title || topic)
    .trim()
    .slice(0, 100)
  let tags = Array.isArray(parsed?.tags)
    ? parsed.tags.map((t) => String(t).replace(/^#/, '').trim().toLowerCase()).filter(Boolean)
    : Array.isArray(script?.tags)
      ? script.tags.map((t) => String(t).replace(/^#/, '').trim().toLowerCase()).filter(Boolean)
      : ['football', 'shorts']

  tags = tags.filter((t) => t !== 'soccer')
  if (!tags.includes(EOF_REQUIRED_HASHTAG)) tags = [EOF_REQUIRED_HASHTAG, ...tags]
  if (!tags.includes('shorts')) tags.push('shorts')
  if (!tags.includes('football')) tags.push('football')
  tags = [...new Set(tags)].slice(0, 12)

  const hashtagsLine =
    String(parsed?.hashtagsLine || '').trim() ||
    tags.map((t) => `#${t}`).join(' ')

  let description = String(parsed?.description || script?.description || `${title}`).trim()
  if (!/#shortsfeed\b/i.test(description)) {
    description = `${description}\n\n${hashtagsLine}`.trim().slice(0, 500)
  }
  if (!/#shorts\b/i.test(description)) {
    description = `${description} #Shorts`.trim().slice(0, 500)
  }

  const sceneCount = script?.scenes?.length || 5
  let thumbnailSceneIndex = Number(parsed?.thumbnailSceneIndex)
  if (!Number.isFinite(thumbnailSceneIndex) || thumbnailSceneIndex < 0 || thumbnailSceneIndex >= sceneCount) {
    thumbnailSceneIndex = 0
  }

  return {
    title,
    description,
    tags,
    hashtagsLine,
    thumbnailSceneIndex,
  }
}
