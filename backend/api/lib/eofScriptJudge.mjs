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
import {
  EOF_SHORTS_DIRECT_VOICE,
  scoreDraftDirectness,
  mergeDirectnessIntoVerdict,
} from '../../../shared/eofScriptDirectness.mjs'
import {
  EOF_SHORTS_HOT_TAKE_VOICE,
  scoreDraftHotTake,
  mergeHotTakeIntoVerdict,
} from '../../../shared/eofScriptHotTake.mjs'
import {
  EOF_SHORTS_FACTUALITY_VOICE,
  scoreDraftFactuality,
  mergeFactualityIntoVerdict,
} from '../../../shared/eofScriptFactuality.mjs'

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
        ? 'Script judge off (EOF_SCRIPT_JUDGE=off) — local directness gate still runs.'
        : isOpenAiConfigured() || isXaiConfigured()
          ? 'Second-tier judge ready — merit / interest / value / directness / factuality (rejects vague waffle + invented news).'
          : isGroqConfigured()
            ? 'Only Groq keyed — judge can run on Groq; OpenAI/xAI is better as a second model. Local directness + factuality always run.'
            : 'Local directness + factuality gates are on. Add OPENAI_API_KEY or XAI_API_KEY for a stronger second-model judge.',
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
  const directness = clampScore(raw?.directness ?? raw?.directnessScore ?? raw?.punch)
  const hotTake = clampScore(raw?.hotTake ?? raw?.bite ?? raw?.punchiness)
  const factuality = clampScore(raw?.factuality ?? raw?.grounding ?? raw?.factLock)
  const overall =
    clampScore(raw?.overall ?? raw?.score) ||
    Number(
      (
        (merit +
          interest +
          value +
          (directness || (merit + interest + value) / 3) +
          (hotTake || (merit + interest + value) / 3) +
          (factuality || (merit + interest + value) / 3)) /
        (directness || hotTake || factuality ? 6 : 3)
      ).toFixed(1),
    )

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
  const dimsOk =
    merit >= min - 1 &&
    interest >= min - 1 &&
    value >= min - 1 &&
    (directness === 0 || directness >= min - 1) &&
    (hotTake === 0 || hotTake >= min - 1.5) &&
    (factuality === 0 || factuality >= min - 1)
  const pass =
    explicitFail
      ? false
      : explicitPass
        ? overall >= min - 0.5 &&
          (directness === 0 || directness >= min - 1.5) &&
          (hotTake === 0 || hotTake >= min - 2) &&
          (factuality === 0 || factuality >= min - 1.5)
        : overall >= min && dimsOk

  return {
    pass,
    overall,
    merit,
    interest,
    value,
    directness,
    hotTake,
    factuality,
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
  const system = `You are the Eyes Of Football desk editor. Second-tier quality gate after the writer model.
Reject vague, bookish, over-the-surface VO that needs human regenerate loops — automation cannot ship waffle.

${EOF_FOOTBALL_SCOPE}

${EOF_SHORTS_DIRECT_VOICE}

${EOF_SHORTS_HOT_TAKE_VOICE}

${EOF_SHORTS_FACTUALITY_VOICE}

Score 0–10 on:
- merit: factual substance grounded in the desk brief — names/events clear, NO invented scores/quotes/transfers/retirements/comebacks/injuries/sackings beyond the brief
- interest: would a football fan STOP scrolling? hot take + opinion + stakes (not a news paste)
- value: truly valuable angle (tactics/selection/pride/quote row) vs empty fluff / career waffle
- directness: punchy desk copy with concrete claims/responses — NOT soft storytelling
- hotTake: bite + "now" energy — would people argue in comments?
- factuality: every asserted career-status / breaking claim appears in DESK BRIEF or topic (else hard fail)

HARD FAIL (pass=false) if:
- vague / bookish / "journey/narrative/chapter" tone
- quote/claim topics that never say who said what / who hit back
- soccer/NFL language
- zero concrete football claim / stake
- canned template glue ("fans are arguing about right now", "ignore the noise")
- article copy-paste with no sharp take
- invented news: transfers, retirements, comebacks, injuries, sackings, appointments, or "breaking" claims NOT in the desk brief / topic (e.g. inventing a player coming back from retirement)

Return JSON only:
{
  "pass": boolean,
  "overall": number,
  "merit": number,
  "interest": number,
  "value": number,
  "directness": number,
  "hotTake": number,
  "factuality": number,
  "reasons": string[],
  "rewriteHints": string[]
}`

  const user = `Topic: ${topic}
Format: ${format}

DESK BRIEF (ground truth — inventing beyond this hurts merit AND factuality):
${String(deskBrief || '(none)').slice(0, 3500)}

SCRIPT TO JUDGE:
"""
${String(draft || '').trim().slice(0, 1800)}
"""

Judge merit, interest, value, directness, hotTake, AND factuality. Fail soft waffle, news paste, AND any invented career/news events even if names appear.`

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

  const local = scoreDraftDirectness(draft, { format: input.format, topic: input.topic })
  const hot = scoreDraftHotTake(draft, { format: input.format, topic: input.topic })
  const fact = scoreDraftFactuality(draft, {
    format: input.format,
    topic: input.topic,
    deskBrief: input.deskBrief,
  })
  const judgeProvider = resolveScriptJudgeProvider(input.writerProvider)
  if (!judgeProvider) {
    // Local directness + hot-take + factuality gates still block waffle / invented news without a second API.
    const merged = mergeFactualityIntoVerdict(
      mergeHotTakeIntoVerdict(
        mergeDirectnessIntoVerdict(
          {
            pass: local.pass && hot.pass && fact.pass,
            overall: Math.min(local.score, hot.score, fact.score),
            merit: Math.min(local.score, fact.score),
            interest: hot.score,
            value: local.score,
            reasons: [
              ...(local.pass && hot.pass && fact.pass
                ? ['Second model unavailable — local directness + hot-take + factuality gates only']
                : []),
              ...local.reasons,
              ...hot.reasons,
              ...fact.reasons,
            ].slice(0, 7),
            rewriteHints: [...local.rewriteHints, ...hot.rewriteHints, ...fact.rewriteHints].slice(
              0,
              6,
            ),
            judgeProvider: 'local-directness+hot-take+factuality',
            threshold: passThreshold(),
            skipped: false,
          },
          local,
        ),
        hot,
      ),
      fact,
    )
    return merged
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

  const modelVerdict = normalizeVerdict(raw, judgeProvider)
  const verdict = mergeFactualityIntoVerdict(
    mergeHotTakeIntoVerdict(
      mergeDirectnessIntoVerdict({ ...modelVerdict, skipped: false }, local),
      hot,
    ),
    fact,
  )
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
    'directness',
    verdict.directness,
    'hotTake',
    verdict.hotTake,
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
    `Scores — merit ${verdict.merit}/10, interest ${verdict.interest}/10, value ${verdict.value}/10, hotTake ${verdict.hotTake ?? '—'}/10 (need ≥${verdict.threshold}).`,
  )
  bits.push(
    'Rewrite as a HOT TAKE: named conflict, concrete stake (tactics/selection/pride/result/quote), timely now-signal, sharp agree/disagree CTA. No article paste.',
  )
  bits.push(
    'FACT LOCK: Do NOT invent transfers, retirements, comebacks, injuries, sackings, or breaking claims absent from the desk brief. Prefer opinion/commentary on sourced facts.',
  )
  return [context, 'EDITOR JUDGE FEEDBACK (must address):\n' + bits.join('\n')].filter(Boolean).join('\n\n')
}
