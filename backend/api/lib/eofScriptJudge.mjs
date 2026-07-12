/**
 * Second-model script judge for EOF Shorts.
 * Writer (usually Groq) drafts; a different model scores merit + interest + real value.
 *
 * Env:
 *   EOF_SCRIPT_JUDGE=auto|openai|xai|groq|off  (default auto)
 *   EOF_SCRIPT_JUDGE_MIN=6.5                   overall pass threshold 0–10
 *   OPENAI_API_KEY / XAI_API_KEY / GROQ_API_KEY
 */
import { isXaiConfigured, xaiJsonCompletion } from './eofXaiClient.mjs'
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

function isOpenAiConfigured() {
  return Boolean(envKey('OPENAI_API_KEY'))
}

function isGroqConfigured() {
  return Boolean(envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY'))
}

export function eofScriptJudgeStatus() {
  const mode = (envKey('EOF_SCRIPT_JUDGE') || 'auto').toLowerCase()
  return {
    mode: ['off', 'auto', 'openai', 'xai', 'groq'].includes(mode) ? mode : 'auto',
    openai: isOpenAiConfigured(),
    xai: isXaiConfigured(),
    groq: isGroqConfigured(),
    enabled: mode !== 'off' && (isOpenAiConfigured() || isXaiConfigured() || isGroqConfigured()),
    note:
      mode === 'off'
        ? 'Script judge off (EOF_SCRIPT_JUDGE=off).'
        : isOpenAiConfigured() || isXaiConfigured()
          ? 'Judge ready — a second model scores merit / interest / real value.'
          : isGroqConfigured()
            ? 'Only Groq is keyed — judge can run on Groq, but a second model (OpenAI or xAI) is better.'
            : 'Add OPENAI_API_KEY or XAI_API_KEY so a second model can judge Groq drafts.',
  }
}

/**
 * Prefer a different model than the writer.
 * @param {string} writerProvider
 * @returns {'openai'|'xai'|'groq'|null}
 */
export function resolveScriptJudgeProvider(writerProvider) {
  const mode = (envKey('EOF_SCRIPT_JUDGE') || 'auto').toLowerCase()
  if (mode === 'off' || mode === 'none' || mode === '0') return null

  const writer = String(writerProvider || '').toLowerCase()
  const forced = mode === 'openai' || mode === 'xai' || mode === 'groq' ? mode : null
  if (forced) {
    if (forced === 'openai' && isOpenAiConfigured()) return 'openai'
    if (forced === 'xai' && isXaiConfigured()) return 'xai'
    if (forced === 'groq' && isGroqConfigured()) return 'groq'
    return null
  }

  // auto — different model from writer when possible
  const order =
    writer === 'groq'
      ? ['openai', 'xai', 'groq']
      : writer === 'openai'
        ? ['xai', 'groq', 'openai']
        : writer === 'xai'
          ? ['openai', 'groq', 'xai']
          : ['openai', 'xai', 'groq']

  for (const id of order) {
    if (id === 'openai' && isOpenAiConfigured()) return 'openai'
    if (id === 'xai' && isXaiConfigured()) return 'xai'
    if (id === 'groq' && isGroqConfigured()) return 'groq'
  }
  return null
}

function passThreshold() {
  const n = Number(envKey('EOF_SCRIPT_JUDGE_MIN') || 6.5)
  return Number.isFinite(n) ? Math.min(9.5, Math.max(4, n)) : 6.5
}

function normalizeVerdict(raw, judgeProvider) {
  const merit = clampScore(raw?.merit ?? raw?.meritScore)
  const interest = clampScore(raw?.interest ?? raw?.interestScore)
  const value = clampScore(raw?.value ?? raw?.valuableInfo ?? raw?.valueScore)
  const overall =
    clampScore(raw?.overall ?? raw?.score) ||
    Number((((merit + interest + value) / 3) || 0).toFixed(1))

  const reasons = Array.isArray(raw?.reasons)
    ? raw.reasons.map((r) => String(r).trim()).filter(Boolean).slice(0, 5)
    : String(raw?.reason || '')
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5)

  const rewriteHints = Array.isArray(raw?.rewriteHints)
    ? raw.rewriteHints.map((r) => String(r).trim()).filter(Boolean).slice(0, 4)
    : String(raw?.rewriteHint || raw?.fix || '')
        .split(/[|;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4)

  const min = passThreshold()
  const explicitPass = raw?.pass === true || String(raw?.verdict || '').toLowerCase() === 'pass'
  const explicitFail = raw?.pass === false || String(raw?.verdict || '').toLowerCase() === 'fail'
  const pass =
    explicitFail
      ? false
      : explicitPass
        ? overall >= min - 0.5
        : overall >= min && merit >= min - 1 && interest >= min - 1 && value >= min - 1

  return {
    pass,
    overall,
    merit,
    interest,
    value,
    reasons,
    rewriteHints,
    judgeProvider,
    threshold: min,
  }
}

function clampScore(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10))
}

function buildJudgePrompts({ topic, format, draft, deskBrief }) {
  const system = `You are the Eyes Of Football desk editor. Judge Shorts voiceover scripts ruthlessly.

${EOF_FOOTBALL_SCOPE}

Score 0–10 on:
- merit: factual substance, names/events clear, no invented scores/quotes beyond the desk brief
- interest: would a football fan stop scrolling? hook + opinion + stakes
- value: is this truly valuable info (news/insight/angle) vs empty fluff / filler / generic career waffle

Fail scripts that are vague, bookish, soccer/NFL, clickbait lies, or zero new information.

Return JSON only:
{
  "pass": boolean,
  "overall": number,
  "merit": number,
  "interest": number,
  "value": number,
  "reasons": string[],
  "rewriteHints": string[]
}`

  const user = `Topic: ${topic}
Format: ${format}

DESK BRIEF (ground truth — inventing beyond this hurts merit):
${String(deskBrief || '(none)').slice(0, 3500)}

SCRIPT TO JUDGE:
"""
${String(draft || '').trim().slice(0, 1800)}
"""

Judge on merit, interest, and whether it's truly valuable info.`

  return { system, user }
}

async function judgeWithOpenAi({ system, user }) {
  const key = envKey('OPENAI_API_KEY')
  const model = envKey('OPENAI_JUDGE_MODEL', 'OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o-mini'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`OpenAI judge ${res.status}: ${err.slice(0, 160)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  return JSON.parse(String(content || '{}'))
}

async function judgeWithGroq({ system, user }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  const model = envKey('GROQ_JUDGE_MODEL', 'GROQ_MODEL') || 'llama-3.3-70b-versatile'
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Groq judge ${res.status}: ${err.slice(0, 160)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  return JSON.parse(String(content || '{}'))
}

/**
 * @param {{
 *   topic: string,
 *   draft: string,
 *   format?: string,
 *   deskBrief?: string,
 *   writerProvider?: string,
 * }} input
 */
export async function judgeEofScriptDraft(input = {}) {
  const draft = String(input.draft || '').trim()
  if (draft.length < 40) {
    return {
      pass: false,
      overall: 0,
      merit: 0,
      interest: 0,
      value: 0,
      reasons: ['Draft too short to judge'],
      rewriteHints: ['Write a fuller 90–130 word Shorts voiceover'],
      judgeProvider: null,
      threshold: passThreshold(),
      skipped: false,
    }
  }

  const judgeProvider = resolveScriptJudgeProvider(input.writerProvider)
  if (!judgeProvider) {
    return {
      pass: true,
      overall: 0,
      merit: 0,
      interest: 0,
      value: 0,
      reasons: ['Judge skipped — no second model configured'],
      rewriteHints: [],
      judgeProvider: null,
      threshold: passThreshold(),
      skipped: true,
    }
  }

  const { system, user } = buildJudgePrompts({
    topic: input.topic,
    format: input.format || 'news',
    draft,
    deskBrief: input.deskBrief,
  })

  let raw
  if (judgeProvider === 'xai') {
    raw = await xaiJsonCompletion({ system, user, temperature: 0.2 })
  } else if (judgeProvider === 'openai') {
    raw = await judgeWithOpenAi({ system, user })
  } else {
    raw = await judgeWithGroq({ system, user })
  }

  const verdict = normalizeVerdict(raw, judgeProvider)
  console.info(
    '[eof-script-judge]',
    judgeProvider,
    'pass',
    verdict.pass,
    'overall',
    verdict.overall,
    'merit',
    verdict.merit,
    'interest',
    verdict.interest,
    'value',
    verdict.value,
  )
  return { ...verdict, skipped: false }
}

/** Append judge rewrite hints into a desk context string for a rewrite pass. */
export function appendJudgeFeedbackToContext(context, verdict) {
  if (!verdict || verdict.skipped || verdict.pass) return context
  const bits = []
  if (verdict.reasons?.length) bits.push(`Judge rejected: ${verdict.reasons.join('; ')}`)
  if (verdict.rewriteHints?.length) bits.push(`Fix: ${verdict.rewriteHints.join('; ')}`)
  bits.push(
    `Scores — merit ${verdict.merit}/10, interest ${verdict.interest}/10, value ${verdict.value}/10 (need ≥${verdict.threshold}).`,
  )
  return [context, 'EDITOR JUDGE FEEDBACK (must address):\n' + bits.join('\n')].filter(Boolean).join('\n\n')
}
