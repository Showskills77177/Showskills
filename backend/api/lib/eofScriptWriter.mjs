/**
 * Script writer for EOF image Shorts.
 * Provider order (first configured wins):
 *   1) xAI Grok  (XAI_API_KEY)
 *   2) OpenAI    (OPENAI_API_KEY) — default gpt-4o
 *   3) Groq      (GROQ_API_KEY) — free-tier Llama
 * Falls back to structured templates when none work.
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

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function eofScriptProviderStatus() {
  return {
    xai: Boolean(envKey('XAI_API_KEY', 'EOF_XAI_API_KEY')),
    openai: Boolean(envKey('OPENAI_API_KEY')),
    groq: Boolean(envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')),
  }
}

/** True when any LLM script provider is configured. */
export function isEofOpenAiScriptConfigured() {
  const s = eofScriptProviderStatus()
  return s.xai || s.openai || s.groq
}

/**
 * @param {{ topic: string, format?: string }} input
 */
export async function writeEofProductionScript({ topic, format }) {
  const t = String(topic || '').trim()
  if (t.length < 2) throw new Error('Topic is required (min 2 characters).')
  const fmt = resolveFormat(format)
  const status = eofScriptProviderStatus()

  const attempts = []
  if (status.xai) attempts.push(() => writeEofScriptWithXai({ topic: t, format: fmt }))
  if (status.openai) attempts.push(() => writeEofScriptWithOpenAi({ topic: t, format: fmt }))
  if (status.groq) attempts.push(() => writeEofScriptWithGroq({ topic: t, format: fmt }))

  for (const run of attempts) {
    try {
      const ai = await run()
      if (ai?.script) return ai
    } catch (e) {
      console.warn('[eof-script] provider failed', e instanceof Error ? e.message : e)
    }
  }

  return {
    script: buildFactsShortScript(t, { format: fmt }),
    source: 'template',
  }
}

function formatGuide(format) {
  return {
    listicle:
      '5 scenes: cold-open hook that creates a curiosity gap, then 3 specific angles (era/club/rivalry/style/pressure), then a comment CTA. Title like a Short thumbnail line.',
    hook_reveal:
      '5 scenes: bold claim → origin context → the turning-point season/move → the peak night or era → CTA. Build tension; pay it off in scene 4.',
    debate:
      '5 scenes: hot take → strongest critic angle → strongest fan angle → nuanced verdict → ask viewers to pick a side.',
    timeline:
      '5 scenes: career arc — start, breakthrough, peak, late-career/legacy, CTA. Each scene = one era, not vague praise.',
  }[format]
}

function buildPrompt({ topic, format }) {
  const system = `You are a senior YouTube Shorts writer for Eyes Of Football — a football channel that wins the scroll with depth, not fluff.

Hard rules:
- Exactly 5 scenes.
- Each caption is ON-SCREEN TEXT and spoken as voiceover. Max 14 words. Punchy. Mobile-first. No hashtags in captions.
- Ban empty filler: never write vague lines like "rewrote elite", "global superstar energy", "moments fans still argue about", "raw talent", or "unforgettable nights" unless you attach a concrete angle (club, rivalry, role, era, style trait).
- Prefer specific, defensible angles: breakthrough club, signature role, famous rivalry, pressure narrative, late-career chapter. Do NOT invent exact match scores, trophy counts, or dates you are unsure about — use career language instead.
- Hook (scene 1) must create a curiosity gap ("why / how / the part nobody talks about").
- CTA (scene 5) must ask a clear question viewers can answer in one comment.
- Each scene needs imageQuery: short English stock-photo search (player name + action/stadium/celebration/portrait). Make queries photo-searchable.
- Return JSON only.
- Format: ${format}. ${formatGuide(format)}`

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

  return { system, user }
}

async function chatJsonCompletion({ url, headers, body }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${errText.slice(0, 240)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('empty script content')
  let parsed
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('script was not valid JSON')
  }
  return parsed
}

function finalizeScript(parsed, topic, format, source) {
  const normalized = normalizeEofScript({ ...parsed, format }, topic)
  if (!normalized || normalized.scenes.length < 3) {
    throw new Error('script had too few scenes')
  }
  normalized.scenes = normalized.scenes.slice(0, 6)
  return { script: normalized, source }
}

async function writeEofScriptWithXai({ topic, format }) {
  const key = envKey('XAI_API_KEY', 'EOF_XAI_API_KEY')
  const model = envKey('XAI_MODEL', 'EOF_XAI_MODEL') || 'grok-3-latest'
  const { system, user } = buildPrompt({ topic, format })
  const parsed = await chatJsonCompletion({
    url: 'https://api.x.ai/v1/chat/completions',
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  })
  return finalizeScript(parsed, topic, format, 'xai')
}

async function writeEofScriptWithOpenAi({ topic, format }) {
  const key = envKey('OPENAI_API_KEY')
  const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
  const { system, user } = buildPrompt({ topic, format })
  const parsed = await chatJsonCompletion({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  })
  return finalizeScript(parsed, topic, format, 'openai')
}

async function writeEofScriptWithGroq({ topic, format }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  const model = envKey('GROQ_MODEL', 'EOF_GROQ_MODEL') || 'llama-3.3-70b-versatile'
  const { system, user } = buildPrompt({ topic, format })
  const parsed = await chatJsonCompletion({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model,
      temperature: 0.55,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  })
  return finalizeScript(parsed, topic, format, 'groq')
}
