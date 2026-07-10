/**
 * Script writer for EOF image Shorts — two-step flow:
 *   1) Plain-text desk draft (continuous narration)
 *   2) Adapt draft → Short scenes (captions + image queries)
 *
 * Provider order (first configured wins):
 *   1) xAI Grok 4.5  (XAI_API_KEY)
 *   2) OpenAI        (OPENAI_API_KEY) — default gpt-4o / set OPENAI_MODEL=gpt-4.1
 *   3) Groq          (GROQ_API_KEY) — free-tier Llama
 * Falls back to structured templates when none work.
 *
 * Scope: football worldwide (World Cup, all leagues) — call it football, never soccer.
 * Never American football / NFL.
 */
import {
  buildFactsShortScript,
  normalizeEofScript,
  EOF_DEFAULT_SCRIPT_FORMAT,
  EOF_SCRIPT_FORMATS,
  EOF_FOOTBALL_SCOPE,
  EOF_MAX_SCENES,
} from '../../../shared/eofScriptTemplates.mjs'
import { isXaiConfigured, xaiJsonCompletion, xaiTextCompletion } from './eofXaiClient.mjs'
import { resolveEofScriptBrief } from './eofNewsTopics.mjs'

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
    xai: isXaiConfigured(),
    openai: Boolean(envKey('OPENAI_API_KEY')),
    groq: Boolean(envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')),
  }
}

/** Primary LLM provider for new scripts (first configured). */
export function preferredEofScriptProvider() {
  const s = eofScriptProviderStatus()
  if (s.xai) return 'xai'
  if (s.openai) return 'openai'
  if (s.groq) return 'groq'
  return 'template'
}

export function eofScriptProviderLabel(provider) {
  if (provider === 'xai') return 'xAI Grok 4.5'
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'groq') return 'Groq'
  return 'template'
}

/** True when any LLM script provider is configured. */
export function isEofOpenAiScriptConfigured() {
  const s = eofScriptProviderStatus()
  return s.xai || s.openai || s.groq
}

function formatGuide(format) {
  return {
    listicle:
      '5 scenes: cold-open hook that creates a curiosity gap, then 3 specific football angles (club/nation/era/rivalry/style/pressure), then a comment CTA.',
    hook_reveal:
      '5 scenes: bold claim → origin context → the turning-point season/move → the peak night or era → CTA. Build tension; pay it off in scene 4.',
    debate:
      '5 scenes: hot take → strongest critic angle → strongest fan angle → nuanced verdict → ask viewers to pick a side.',
    timeline:
      '5 scenes: career arc — start, breakthrough, peak, late-career/legacy, CTA. Each scene = one club/nation/tournament era.',
    news:
      '5 scenes in Sky Sports / ESPN FC / ITV Sport / BBC Sport / The Athletic newsroom style: BREAKING hook → what happened → why it matters → what happens next → viewer CTA. World Cup, club, or international football worldwide.',
  }[format]
}

function draftFormatGuide(format) {
  return {
    listicle:
      'Write like a sharp football column: open with the surprising angle, then 3 concrete football beats, end with a question for comments.',
    hook_reveal:
      'Build tension: bold claim, context, turning point, payoff. Sound like a narrator who knows the clubs, nations, and eras.',
    debate:
      'Present a hot take, the critic case, the fan case, then a fair verdict. End with a side to pick.',
    timeline:
      'Tell the career in eras — start, breakthrough, peak, legacy — with real clubs/nations/tournaments, not empty praise.',
    news:
      'Write like Sky Sports / BBC Sport / ESPN FC desk copy for a 30–45s Short. Lead with the result or event (teams, competition, what happened). World Cup 2026 and global football welcome. Then context, stakes, and what comes next. Always say football — never soccer.',
  }[format]
}

/**
 * Shell script object for draft-only jobs (no scenes yet).
 */
export function buildEofDraftShell({ topic, format, plainTextDraft, title, source }) {
  const t = String(topic || '').trim() || 'Football'
  const fmt = resolveFormat(format)
  const draft = String(plainTextDraft || '').trim()
  return {
    topic: t,
    title: String(title || t).trim().slice(0, 100),
    description: '',
    tags: ['shortsfeed', 'football'],
    format: fmt,
    plainTextDraft: draft,
    scenes: [],
    draftSource: source || null,
  }
}

function templatePlainTextDraft(topic, format) {
  const name = String(topic || '').trim() || 'This football story'
  const clean = name.replace(/\s+/g, ' ')
  if (format === 'news' || /\bworld cup|transfer|injury|manager|final|derby\b/i.test(clean)) {
    if (/spain/i.test(clean) && /belgium/i.test(clean)) {
      return `Spain just sent a World Cup message — they beat Belgium with control, not chaos. For Belgium, another tournament night ends with the same question: talent without a ruthless edge. Spain now look like a side that can manage big games, not just dominate possession. Are Spain genuine contenders from here, or was this one good night? Comment.`
    }
    if (/england/i.test(clean) && /\bworld cup\b/i.test(clean)) {
      return `England are living on the edge again at the World Cup — the talent is obvious, the calm under pressure is not. One soft moment and the whole nation debate restarts: system, selections, and nerve. Tournament football does not care about friendly form. Can England close a big game the ugly way when it matters? Drop your take.`
    }
    return `${clean} — that is the football story fans are arguing about right now. The result changes the table talk, the dressing-room pressure, and what comes next in the competition. Ignore the noise: tournament and club football are decided by who handles the big moments, not who wins the highlight reel. Who comes out of this looking stronger — and who is in trouble? Comment below.`
  }
  if (format === 'debate') {
    return `${clean} splits football opinion for a reason. One side sees proven quality on the biggest nights; the other sees gaps that get exposed when the game turns ugly. Strip away the tribal noise and you still have a real football argument about levels, roles, and clutch moments. Which side are you on — and why? Comment.`
  }
  if (format === 'timeline') {
    return `${clean} did not arrive fully formed. The early years built the habits, the breakthrough season changed the ceiling, and the peak nights locked in the reputation. Late-career chapters always reopen the same debate: was the peak even better than fans remember? Which era defines ${clean} for you? Comment below.`
  }
  return `${clean} still divides football fans for a reason. The early club years built the foundation, the big-stage move raised the stakes, and the rivalry nights made the legend stick. Which era was the real peak? Comment below.`
}

/** Human-readable warning when AI script writing fell back to templates. */
export function buildEofScriptWarning(jobOrSource, providers = eofScriptProviderStatus()) {
  const source =
    typeof jobOrSource === 'string'
      ? jobOrSource
      : jobOrSource?.scriptSource || jobOrSource?.script?.draftSource || null
  if (source && source !== 'template') return null
  if (providers.xai) {
    return 'xAI Grok failed — usually no credits on your xAI team (console.x.ai). This is a built-in fallback draft. Add credits, or set OPENAI_API_KEY / GROQ_API_KEY on Vercel for real AI scripts.'
  }
  if (!providers.openai && !providers.groq) {
    return 'No working AI script provider. Set XAI_API_KEY (with credits), OPENAI_API_KEY, or free GROQ_API_KEY on Vercel.'
  }
  return 'AI script providers failed — using a built-in fallback draft. Check API keys and billing.'
}

const DRAFT_FLUFF_RE =
  /here'?s what we know so far|the result or move that matters|why clubs and fans care|just another chapter|global superstar energy|rewrote elite|unforgettable nights|raw talent|most fans still miss/i

function isWeakDraft(text, topic) {
  const t = String(text || '').trim()
  if (t.length < 120) return true
  if (DRAFT_FLUFF_RE.test(t)) return true
  // Must mention at least one capitalised proper-looking token beyond filler
  const proper = (t.match(/\b[A-Z][a-z]{2,}\b/g) || []).filter(
    (w) => !/^(The|This|That|Then|When|What|With|From|After|Before|For|And|But|Are|Was|Were|Who|How|Why|Not|One|Another)$/.test(w),
  )
  if (proper.length < 2) return true
  // If topic names teams, draft should not ignore football specificity entirely
  if (/\b(world cup|ucl|premier|liga|serie|bundesliga)\b/i.test(topic) && !/\b(world cup|fifa|spain|england|france|germany|brazil|argentina|portugal|belgium|netherlands|italy|croatia|mexico|usa|japan|korea|match|group|knockout|final|tournament)\b/i.test(t)) {
    return true
  }
  return false
}

/**
 * Step 1 — continuous plain-text narration (editable in the UI).
 * Vague topics like "world cup news" are resolved into a concrete headline first.
 * @param {{ topic: string, format?: string, context?: string }} input
 */
function withBudget(promise, ms, label) {
  let timer
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    }),
  ])
}

export async function writeEofPlainTextDraft({ topic, format, context }) {
  const rawTopic = String(topic || '').trim()
  if (rawTopic.length < 2) throw new Error('Topic is required (min 2 characters).')
  const fmt = resolveFormat(format)

  let t = rawTopic
  let ctx = String(context || '').trim()
  let resolvedTopic = null

  try {
    // Keep topic resolve short — never block Create job on a slow Grok call
    const brief = await withBudget(
      resolveEofScriptBrief({ topic: rawTopic, format: fmt }),
      25000,
      'topic resolve',
    )
    if (brief?.resolved && brief.topic) {
      t = brief.topic
      resolvedTopic = brief.topic
      ctx = [ctx, brief.context].filter(Boolean).join('\n')
    }
  } catch (e) {
    console.warn('[eof-script] topic resolve skipped', e instanceof Error ? e.message : e)
  }

  const status = eofScriptProviderStatus()
  const attempts = []
  if (status.xai) attempts.push(() => writeDraftWithXai({ topic: t, format: fmt, context: ctx }))
  if (status.openai) attempts.push(() => writeDraftWithOpenAi({ topic: t, format: fmt, context: ctx }))
  if (status.groq) attempts.push(() => writeDraftWithGroq({ topic: t, format: fmt, context: ctx }))

  for (const run of attempts) {
    try {
      const ai = await withBudget(run(), 70000, 'draft provider')
      if (ai?.plainTextDraft && !isWeakDraft(ai.plainTextDraft, t)) {
        return {
          ...ai,
          title: ai.title || t.slice(0, 90),
          resolvedTopic,
        }
      }
      console.warn('[eof-script] draft rejected as weak/fluff', ai?.source)
    } catch (e) {
      console.warn('[eof-script] draft provider failed', e instanceof Error ? e.message : e)
    }
  }

  return {
    plainTextDraft: templatePlainTextDraft(t, fmt),
    title: t.slice(0, 90),
    source: 'template',
    resolvedTopic,
  }
}

/**
 * Step 2 — split approved plain text into Short scenes.
 * @param {{ plainTextDraft: string, topic: string, format?: string }} input
 */
export async function adaptEofPlainTextToScenes({ plainTextDraft, topic, format }) {
  const draft = String(plainTextDraft || '').trim()
  if (draft.length < 40) throw new Error('Plain-text draft is too short — write or generate a fuller script first.')
  const t = String(topic || '').trim() || 'Football'
  const fmt = resolveFormat(format)
  const status = eofScriptProviderStatus()

  const attempts = []
  if (status.xai) attempts.push(() => adaptWithXai({ draft, topic: t, format: fmt }))
  if (status.openai) attempts.push(() => adaptWithOpenAi({ draft, topic: t, format: fmt }))
  if (status.groq) attempts.push(() => adaptWithGroq({ draft, topic: t, format: fmt }))

  for (const run of attempts) {
    try {
      const ai = await withBudget(run(), 70000, 'adapt provider')
      if (ai?.script?.scenes?.length >= 3) {
        ai.script.plainTextDraft = draft
        return ai
      }
    } catch (e) {
      console.warn('[eof-script] adapt provider failed', e instanceof Error ? e.message : e)
    }
  }

  // Last resort: template scenes, but keep the human/AI draft attached
  const script = buildFactsShortScript(t, { format: fmt })
  script.plainTextDraft = draft
  return { script, source: 'template' }
}

/**
 * One-shot (scheduler / legacy): draft then adapt.
 * @param {{ topic: string, format?: string, context?: string }} input
 */
export async function writeEofProductionScript({ topic, format, context }) {
  const draftResult = await writeEofPlainTextDraft({ topic, format, context })
  const resolvedTopic = draftResult.resolvedTopic || topic
  const adapted = await adaptEofPlainTextToScenes({
    plainTextDraft: draftResult.plainTextDraft,
    topic: resolvedTopic,
    format,
  })
  if (adapted?.script) {
    adapted.script.plainTextDraft = draftResult.plainTextDraft
    adapted.script.topic = resolvedTopic
    if (!adapted.script.title && draftResult.title) adapted.script.title = draftResult.title
    if (adapted.source === 'template' && draftResult.source && draftResult.source !== 'template') {
      adapted.source = draftResult.source
    }
  }
  return { ...adapted, resolvedTopic }
}

function buildDraftPrompt({ topic, format, context }) {
  const system = `You are a senior football writer for Eyes Of Football (YouTube Shorts).

HARD SCOPE:
${EOF_FOOTBALL_SCOPE}

Write ONE continuous voiceover script as plain prose — NOT JSON, NOT bullet points, NOT scene labels, NOT hashtags.

MANDATORY QUALITY BAR:
- 110–170 words. Spoken aloud in ~40–55 seconds.
- Sound like Sky Sports News / BBC Sport / ESPN FC at 10pm — specific, opinionated, common-sense.
- Always say football — never soccer.
- FIRST SENTENCE must name the teams / player / club and the event (e.g. "Spain beat Belgium…", "Salah's contract…").
- Include at least TWO concrete football references (nations, clubs, competitions, managers, or roles).
- For World Cup / news: lead with the result or decisive moment, then stakes, then what happens next. World Cup 2026 and global football are in scope.
- Prefer known, defensible facts. If a score is uncertain, say "narrow win" / "statement result" — never invent fake 3-1 lines.
- Ban these phrases forever: "here's what we know so far", "the key detail fans need", "why it matters for the club", "just another chapter", "global superstar energy", "raw talent", "unforgettable nights", "most fans still miss".
- End with ONE sharp question for comments.
- Format intent: ${format}. ${draftFormatGuide(format)}`

  const user = `Topic / headline: ${topic}
${context ? `\nDesk brief (use these facts; do not ignore them):\n${context}\n` : ''}
Write the plain-text Short script only. No preamble.`

  return { system, user }
}

function buildAdaptPrompt({ draft, topic, format }) {
  const system = `You adapt an APPROVED Eyes Of Football narration into YouTube Short scenes.

HARD SCOPE:
${EOF_FOOTBALL_SCOPE}

Hard rules:
- Exactly 5 scenes (4–6 only if the draft truly needs it; never more than ${EOF_MAX_SCENES}).
- Each caption is ON-SCREEN TEXT and spoken as voiceover. Max 14 words. Punchy. Mobile-first. No hashtags in captions.
- Always say football — never soccer.
- PRESERVE the draft's facts, teams, and meaning — compress, do not replace with generic filler.
- Hook (scene 1) from the draft's lead. CTA (last scene) from the draft's question.
- Each scene needs imageQuery: short English stock-photo search (teams/players + action/stadium/celebration) using the word football, not soccer.
- tags must include "shortsfeed" and football keywords (never NFL / American football).
- Return JSON only.
- Format: ${format}. ${formatGuide(format)}`

  const user = `Topic: ${topic}

Approved narration draft:
"""
${draft}
"""

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
    parsed = parseJsonContent(content)
  } catch {
    throw new Error('script was not valid JSON')
  }
  return parsed
}

async function chatTextCompletion({ url, headers, body }) {
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
  if (!content?.trim()) throw new Error('empty draft content')
  return String(content).trim()
}

function parseJsonContent(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

function finalizeScript(parsed, topic, format, source, plainTextDraft) {
  const normalized = normalizeEofScript(
    { ...parsed, format, plainTextDraft: plainTextDraft || parsed?.plainTextDraft },
    topic,
  )
  if (!normalized || normalized.scenes.length < 3) {
    throw new Error('script had too few scenes')
  }
  normalized.scenes = normalized.scenes.slice(0, EOF_MAX_SCENES)
  if (plainTextDraft) normalized.plainTextDraft = plainTextDraft
  return { script: normalized, source }
}

function cleanDraftText(text) {
  let t = String(text || '').trim()
  // Strip accidental markdown fences / "Script:" prefixes
  t = t.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim()
  t = t.replace(/^(?:script|narration|voiceover)\s*:\s*/i, '').trim()
  return t
}

function titleFromDraft(topic, draft) {
  const first = String(draft || '')
    .split(/[.!?]/)
    .map((s) => s.trim())
    .find(Boolean)
  if (first && first.length >= 12 && first.length <= 90) return first
  return String(topic || '').trim().slice(0, 90)
}

async function writeDraftWithXai({ topic, format, context }) {
  const { system, user } = buildDraftPrompt({ topic, format, context })
  const text = cleanDraftText(await xaiTextCompletion({ system, user, temperature: 0.35 }))
  if (text.length < 40) throw new Error('draft too short')
  return { plainTextDraft: text, title: titleFromDraft(topic, text), source: 'xai' }
}

async function writeDraftWithOpenAi({ topic, format, context }) {
  const key = envKey('OPENAI_API_KEY')
  const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
  const { system, user } = buildDraftPrompt({ topic, format, context })
  const text = cleanDraftText(
    await chatTextCompletion({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${key}` },
      body: {
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
    }),
  )
  if (text.length < 40) throw new Error('draft too short')
  return { plainTextDraft: text, title: titleFromDraft(topic, text), source: 'openai' }
}

async function writeDraftWithGroq({ topic, format, context }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  const model = envKey('GROQ_MODEL', 'EOF_GROQ_MODEL') || 'llama-3.3-70b-versatile'
  const { system, user } = buildDraftPrompt({ topic, format, context })
  const text = cleanDraftText(
    await chatTextCompletion({
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: { Authorization: `Bearer ${key}` },
      body: {
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
    }),
  )
  if (text.length < 40) throw new Error('draft too short')
  return { plainTextDraft: text, title: titleFromDraft(topic, text), source: 'groq' }
}

async function adaptWithXai({ draft, topic, format }) {
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  const parsed = await xaiJsonCompletion({ system, user, temperature: 0.35 })
  return finalizeScript(parsed, topic, format, 'xai', draft)
}

async function adaptWithOpenAi({ draft, topic, format }) {
  const key = envKey('OPENAI_API_KEY')
  const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  const parsed = await chatJsonCompletion({
    url: 'https://api.openai.com/v1/chat/completions',
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  })
  return finalizeScript(parsed, topic, format, 'openai', draft)
}

async function adaptWithGroq({ draft, topic, format }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  const model = envKey('GROQ_MODEL', 'EOF_GROQ_MODEL') || 'llama-3.3-70b-versatile'
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  const parsed = await chatJsonCompletion({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    headers: { Authorization: `Bearer ${key}` },
    body: {
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    },
  })
  return finalizeScript(parsed, topic, format, 'groq', draft)
}
