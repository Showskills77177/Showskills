/**
 * Script writer for EOF image Shorts.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise structured templates.
 */
import {
  buildFactsShortScript,
  normalizeEofScript,
  EOF_DEFAULT_SCRIPT_FORMAT,
  EOF_SCRIPT_FORMATS,
} from '../../../shared/eofScriptTemplates.mjs'

const FORMAT_IDS = new Set(EOF_SCRIPT_FORMATS.map((f) => f.id))

function resolveFormat(format) {
  const id = String(format || EOF_DEFAULT_SCRIPT_FORMAT).trim()
  return FORMAT_IDS.has(id) ? id : EOF_DEFAULT_SCRIPT_FORMAT
}

export function isEofOpenAiScriptConfigured() {
  return Boolean((process.env.OPENAI_API_KEY || '').trim())
}

/**
 * @param {{ topic: string, format?: string }} input
 */
export async function writeEofProductionScript({ topic, format }) {
  const t = String(topic || '').trim()
  if (t.length < 2) throw new Error('Topic is required (min 2 characters).')
  const fmt = resolveFormat(format)

  if (isEofOpenAiScriptConfigured()) {
    try {
      const ai = await writeEofScriptWithOpenAi({ topic: t, format: fmt })
      if (ai) return { script: ai, source: 'openai' }
    } catch (e) {
      console.warn('[eof-script] OpenAI failed, using templates', e instanceof Error ? e.message : e)
    }
  }

  return {
    script: buildFactsShortScript(t, { format: fmt }),
    source: 'template',
  }
}

/**
 * @param {{ topic: string, format: string }} input
 */
async function writeEofScriptWithOpenAi({ topic, format }) {
  const key = (process.env.OPENAI_API_KEY || '').trim()
  const model = (process.env.OPENAI_MODEL || process.env.EOF_OPENAI_MODEL || 'gpt-4o-mini').trim()

  const formatGuide = {
    listicle: '5 scenes: hook, 3 punchy facts, CTA. Title like "5 things about X".',
    hook_reveal: '5 scenes: bold hook, origin, turning point, peak, CTA.',
    debate: '5 scenes: hot take, critics, fans, verdict nuance, CTA to comment.',
    timeline: '5 scenes: career arc from start to legacy.',
  }[format]

  const system = `You write YouTube Shorts scripts for a football channel (Eyes Of Football).
Rules:
- Exactly 5 scenes.
- Each scene caption is ON-SCREEN TEXT only (no voiceover). Max 12 words, punchy, mobile-first.
- Each scene needs an imageQuery: short English search phrase for a stock photo (player + action / stadium).
- No invented exact statistics or fake dates. Prefer vibe/career language if unsure.
- Return JSON only matching the schema.
- Format: ${format}. ${formatGuide}`

  const user = `Topic: ${topic}
Return JSON:
{
  "topic": string,
  "title": string,
  "description": string,
  "tags": string[],
  "format": "${format}",
  "scenes": [
    { "caption": string, "imageQuery": string, "role": "hook"|"body"|"cta" }
  ]
}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty script')

  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('OpenAI script was not valid JSON')
  }

  const normalized = normalizeEofScript({ ...parsed, format }, topic)
  if (!normalized || normalized.scenes.length < 3) {
    throw new Error('OpenAI script had too few scenes')
  }
  // Cap at 6 scenes for Short length
  normalized.scenes = normalized.scenes.slice(0, 6)
  return normalized
}
