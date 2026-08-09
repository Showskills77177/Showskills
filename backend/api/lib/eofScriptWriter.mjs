/**
 * Script writer for EOF image Shorts — multi-pass flow:
 *   0) Desk research (RSS headlines + editor brief) — check it is actual / now
 *   1) Hot-take Shorts voiceover draft (spoken argument, not article paste)
 *   2) Polish pass (cut fluff, tighten hook/CTA)
 *   3) Hot-take refine pass (bite + stake + agree/disagree CTA)
 *   4) Second-tier judge (merit / interest / value / directness / hotTake) → rewrite/escalate
 *   5) Adapt draft → Short scenes (captions + image queries)
 *
 * Auto provider order when configured: Anthropic Claude Sonnet → Groq → OpenAI → xAI Grok.
 * When ANTHROPIC_API_KEY is set, Claude is the default even if EOF_SCRIPT_PROVIDER is unset.
 * UI can force a provider via scriptProvider (groq | xai | openai | anthropic | auto).
 * Script Maker uses qualityBar=production and refuses canned templates.
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
import { adaptPlainTextDraftToScenesLocally, unwrapAdaptJson } from '../../../shared/eofSceneAdapt.mjs'
import { isXaiConfigured, xaiJsonCompletion, xaiTextCompletion } from './eofXaiClient.mjs'
import {
  isAnthropicConfigured,
  anthropicJsonCompletion,
  anthropicTextCompletion,
  anthropicModelCandidates,
} from './eofAnthropicClient.mjs'
import { resolveEofScriptBrief } from './eofNewsTopics.mjs'
import {
  fetchFootballDeskHeadlines,
  formatDeskHeadlinesForPrompt,
  buildDeskResearchSystemPrompt,
  buildDeskResearchUserPrompt,
  deskBriefToContext,
  normalizeFootballTopicQuery,
  seedKnownDeskNotesForTopic,
} from './eofFootballDeskResearch.mjs'
import {
  shouldUsePerplexity,
  researchFootballTopicWithPerplexity,
  formatPerplexityResearchForPrompt,
} from './eofPerplexityClient.mjs'
import { fetchFreeFootballDeskPack, isGuardianConfigured, isNewsdataConfigured } from './eofFreeNewsSourcing.mjs'
import {
  sourceEofFootballQuote,
  quoteHitToContext,
  quoteHitToHeadline,
} from './eofQuoteSourcing.mjs'
import {
  judgeEofScriptDraft,
  appendJudgeFeedbackToContext,
  eofScriptJudgeStatus,
} from './eofScriptJudge.mjs'
import {
  EOF_SHORTS_DIRECT_VOICE,
  scoreDraftDirectness,
} from '../../../shared/eofScriptDirectness.mjs'
import {
  EOF_SHORTS_HOT_TAKE_VOICE,
  scoreDraftHotTake,
} from '../../../shared/eofScriptHotTake.mjs'
import {
  EOF_SHORTS_FACTUALITY_VOICE,
  scoreDraftFactuality,
} from '../../../shared/eofScriptFactuality.mjs'
import {
  EOF_SHORTS_RELEVANCE_VOICE,
  scoreDraftRelevance,
} from '../../../shared/eofScriptRelevance.mjs'

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
    anthropic: isAnthropicConfigured(),
    groq: Boolean(envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')),
    newsdata: isNewsdataConfigured(),
    guardian: isGuardianConfigured(),
    perplexity: shouldUsePerplexity(),
    judge: eofScriptJudgeStatus(),
  }
}

const SCRIPT_PROVIDER_IDS = new Set(['auto', 'groq', 'xai', 'openai', 'anthropic', 'claude'])

/** Normalize UI/env aliases (claude → anthropic). */
function normalizeScriptProviderId(id) {
  const pick = String(id || '').toLowerCase().trim()
  if (pick === 'claude') return 'anthropic'
  return pick
}

/** UI + API: script AI options (Claude Sonnet first when keyed). */
export function listEofScriptProviderOptions() {
  const status = eofScriptProviderStatus()
  return [
    {
      id: 'auto',
      label: 'Auto (best quality)',
      configured: true,
      detail: status.anthropic
        ? 'Prefers Claude Sonnet when ANTHROPIC_API_KEY is set, then escalates Groq/OpenAI/xAI. Judges merit/interest/value/factuality/relevance.'
        : 'Tunes temps by format, judges merit/interest/value, then escalates Groq → OpenAI/Claude/xAI until the best script wins.',
    },
    {
      id: 'anthropic',
      label: 'Claude Sonnet 5 (Anthropic)',
      configured: status.anthropic,
      detail:
        'Default writer when ANTHROPIC_API_KEY is set (optional ANTHROPIC_MODEL=claude-sonnet-5). Also used for polish/refine.',
    },
    {
      id: 'groq',
      label: 'Groq — Llama 3.3 70B (free)',
      configured: status.groq,
      detail: 'Free writer at console.groq.com — set GROQ_API_KEY on Vercel.',
    },
    {
      id: 'xai',
      label: 'xAI Grok 4.5',
      configured: status.xai,
      detail: 'Writer or judge — needs paid xAI credits at console.x.ai.',
    },
    {
      id: 'openai',
      label: 'OpenAI',
      configured: status.openai,
      detail: 'Writer or judge — set OPENAI_API_KEY (second-model judge when Claude wrote).',
    },
  ]
}

/** Claude Sonnet first when keyed; then free Groq; then OpenAI / xAI. */
export function defaultAutoProviderOrder(status = eofScriptProviderStatus()) {
  const order = []
  if (status.anthropic) order.push('anthropic')
  if (status.groq) order.push('groq')
  if (status.openai) order.push('openai')
  if (status.xai) order.push('xai')
  return order
}

export function isAutoScriptMode(scriptProvider) {
  const envPick = normalizeScriptProviderId(envKey('EOF_SCRIPT_PROVIDER', 'EOF_DEFAULT_SCRIPT_PROVIDER'))
  const pick = normalizeScriptProviderId(scriptProvider || envPick || 'auto')
  return pick === 'auto' || !SCRIPT_PROVIDER_IDS.has(pick)
}

/** Format-aware temps + excellence bar for Auto quality mode. */
export function autoTuneDraftSettings({
  format,
  regenerate = false,
  directorNote = '',
  qualityBar = 'standard',
} = {}) {
  const fmt = resolveFormat(format)
  const directed = Boolean(String(directorNote || '').trim())
  const production = qualityBar === 'production' || qualityBar === 'script-maker'
  let draftTemperature = 0.42
  let polishTemperature = 0.28
  // News/quotes: cooler = fewer invented facts. Debate/hooks: warmer punch.
  if (fmt === 'news' || fmt === 'quote') {
    draftTemperature = 0.38
    polishTemperature = 0.24
  } else if (fmt === 'debate' || fmt === 'hook_reveal') {
    draftTemperature = 0.58
    polishTemperature = 0.32
  } else if (fmt === 'listicle' || fmt === 'timeline') {
    draftTemperature = 0.46
    polishTemperature = 0.26
  }
  if (regenerate || directed) {
    draftTemperature = Math.min(0.78, draftTemperature + 0.2)
    polishTemperature = 0.24
  }
  if (production) {
    // Slightly warmer for sharper takes; higher excellence bar for overnight batch.
    draftTemperature = Math.min(0.7, draftTemperature + 0.06)
    polishTemperature = Math.min(0.36, polishTemperature + 0.04)
  }
  const excellentDefault = production ? 8 : 7.5
  const excellentMin = Number(envKey('EOF_SCRIPT_AUTO_EXCELLENT') || excellentDefault)
  return {
    draftTemperature,
    polishTemperature,
    excellentMin: Number.isFinite(excellentMin) ? Math.min(9.5, Math.max(6, excellentMin)) : excellentDefault,
    production,
  }
}

function judgeOverall(judge) {
  if (!judge || judge.skipped) return 0
  const n = Number(judge.overall)
  return Number.isFinite(n) ? n : 0
}

function isExcellentJudge(judge, excellentMin) {
  if (!judge || judge.skipped) return true // no judge → don't block
  return Boolean(judge.pass) && judgeOverall(judge) >= excellentMin
}

/** Ordered provider ids to try for draft/adapt (respects UI pick + EOF_SCRIPT_PROVIDER env). */
export function resolveScriptProviderAttemptOrder(scriptProvider) {
  const status = eofScriptProviderStatus()
  const configured = defaultAutoProviderOrder(status)
  const envPick = normalizeScriptProviderId(envKey('EOF_SCRIPT_PROVIDER', 'EOF_DEFAULT_SCRIPT_PROVIDER'))
  // Explicit UI/arg wins; otherwise env; otherwise auto (Claude-first when keyed).
  const rawPick =
    scriptProvider != null && String(scriptProvider).trim() !== ''
      ? scriptProvider
      : envPick || 'auto'
  const pick = normalizeScriptProviderId(rawPick)

  if (pick === 'auto' || !SCRIPT_PROVIDER_IDS.has(pick)) {
    // Auto: Claude Sonnet first when ANTHROPIC_API_KEY is set, then Groq/OpenAI/xAI.
    return configured.filter((id, i, arr) => arr.indexOf(id) === i)
  }

  if (!status[pick]) return configured
  return [pick, ...configured.filter((id) => id !== pick)]
}

/** Primary LLM provider for new scripts (env force, else Claude when keyed). */
export function preferredEofScriptProvider() {
  const order = resolveScriptProviderAttemptOrder(null)
  return order[0] || 'template'
}

export function eofScriptProviderLabel(provider) {
  const id = normalizeScriptProviderId(provider)
  if (id === 'manual') return 'your own script'
  if (id === 'xai') return 'xAI Grok 4.5'
  if (id === 'openai') return 'OpenAI'
  if (id === 'anthropic') {
    const model = anthropicModelCandidates()[0]
    return model ? `Claude (${model})` : 'Claude Sonnet 5 (Anthropic)'
  }
  if (id === 'local-split') return 'Draft split (local)'
  if (id === 'groq') {
    const model = groqModelCandidates()[0]
    return model.includes('llama-3.3')
      ? 'Groq Llama 3.3 70B (free)'
      : model.includes('8b')
        ? 'Groq Llama 3.1 8B (free)'
        : `Groq ${model}`
  }
  return 'template'
}

/** True when any LLM script provider is configured. */
export function isEofOpenAiScriptConfigured() {
  const s = eofScriptProviderStatus()
  return s.xai || s.openai || s.groq || s.anthropic
}

function formatGuide(format) {
  return {
    quote:
      '5 scenes: QUOTE hook (speaker + line) → where it was said → who it targets → why fans bite → agree/disagree CTA.',
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
    quote:
      'QUOTE SHORT — DIRECT CLAIM/RESPONSE only. Pattern: "[A] hit back at [B] after [B] said [concrete claim]. [A] said [concrete response]. That\'s the row. Agree with A or B?" Example: Jude Bellingham hit back at Thomas Tuchel after Tuchel questioned him; Bellingham said Tuchel doesn\'t know what it\'s like to play in that heat. No career essays. No soft "raises questions" filler.',
    listicle:
      'Structure: hook → 3 punchy football beats → CTA. Each beat = one concrete club/nation/era fact. No essay padding.',
    hook_reveal:
      'Structure: bold claim → one origin beat → turning point → payoff → CTA. Tension, then pay it off. Spoken, not literary.',
    debate:
      'HOT TAKE Short: named claim in line 1 → why it bites (tactics/selection/pride) → the pushback → your sharp verdict → pick-a-side CTA. Never soft “both sides” waffle.',
    timeline:
      'Structure: start → breakthrough → peak → legacy → CTA. One era per beat. Real clubs/nations only. Still punchy — not a Wikipedia read.',
    news:
      'BREAKING desk take — not a wire rewrite. Who/what in line 1 → the stake (result/selection/pride) → what it means next → fight CTA. Transform the brief; do not paste the article.',
  }[format]
}

/**
 * Shell script object for draft-only jobs (no scenes yet).
 */
export function buildEofDraftShell({
  topic,
  format,
  plainTextDraft,
  title,
  source,
  judge = null,
  stages = null,
  qualityBar = null,
} = {}) {
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
    judge: judge && !judge.skipped ? judge : null,
    stages: Array.isArray(stages) ? stages : null,
    qualityBar: qualityBar || null,
  }
}

function templatePlainTextDraft(topic, format) {
  // Last-resort only — Script Maker / production qualityBar refuse this path.
  const name = String(topic || '').trim() || 'This football story'
  const clean = name.replace(/\s+/g, ' ')
  if (format === 'quote' || /["“].+["”]|:\s*"/.test(clean)) {
    return `${clean} That line was public. Reputation, selection, and blame are on the table. Who do you back in that row — and who looks soft? Comment.`
  }
  if (format === 'debate') {
    return `${clean} One side says the tactics and selections are costing big nights. The other says the talent is still there and the noise is unfair. Pick a side with a reason. Comment.`
  }
  if (format === 'timeline') {
    return `${clean}: breakthrough years, the peak nights, then the debate about which era was real. Which chapter defines them for you? Comment.`
  }
  return `${clean} — name the stake: result, selection, or pride. Soft summaries do not belong on Shorts. What is your take right now? Comment.`
}

/** Human-readable warning when AI script writing fell back to templates. */
export function buildEofScriptWarning(jobOrSource, providers = eofScriptProviderStatus()) {
  const source =
    typeof jobOrSource === 'string'
      ? jobOrSource
      : jobOrSource?.scriptSource || jobOrSource?.script?.draftSource || null
  const detail =
    typeof jobOrSource === 'object' && jobOrSource
      ? String(jobOrSource.scriptFailureDetail || jobOrSource.failureDetail || '').trim()
      : ''

  if (source === 'previous' || /kept your previous draft/i.test(detail)) {
    return detail
      ? `Could not apply that direction (${detail.slice(0, 140)}). Your previous draft was kept — try a clearer, shorter instruction.`
      : 'Could not apply that direction. Your previous draft was kept — try a clearer, shorter instruction.'
  }

  if (source && source !== 'template') return null

  const blamed = classifyScriptFailureProvider(detail)

  // xAI 403/no-credits is the most common false alarm — never label it as Groq
  if (
    blamed === 'xai' ||
    /xai|console\.x\.ai|team doesn't have any credits|permission-denied/i.test(detail)
  ) {
    if (providers.groq) {
      return 'xAI has no team credits (console.x.ai) — that is not a Groq problem. Pick Groq in Script AI and click Regenerate script.'
    }
    return 'xAI Grok has no team credits (console.x.ai). Add free GROQ_API_KEY at console.groq.com → Vercel → Redeploy, then pick Groq.'
  }

  if (blamed === 'openai') {
    return `OpenAI failed (${detail.slice(0, 140)}). Pick Groq (free) in Script AI, or check OPENAI_API_KEY.`
  }

  if (blamed === 'anthropic') {
    return `Claude/Anthropic failed (${detail.slice(0, 140)}). Check ANTHROPIC_API_KEY / ANTHROPIC_MODEL, or pick Groq in Script AI.`
  }

  if (blamed === 'groq' || providers.groq) {
    if (/401|invalid.?api.?key|incorrect.?api.?key|wrong.?api.?key/i.test(detail)) {
      return `Groq rejected the API key (${detail.slice(0, 120)}). Fix GROQ_API_KEY on Vercel at console.groq.com, then Redeploy.`
    }
    if (/403/.test(detail) && /groq/i.test(detail)) {
      return `Groq returned 403 (${detail.slice(0, 120)}). Check GROQ_API_KEY / plan at console.groq.com, then Redeploy.`
    }
    if (/429|rate.?limit|quota|tpm|rpm/i.test(detail)) {
      return `Groq rate-limited this request (${detail.slice(0, 120)}). Wait ~1 minute and Regenerate script.`
    }
    if (/decommissioned|model_not_found|does not exist|404/i.test(detail)) {
      return `Groq model unavailable (${detail.slice(0, 140)}). Set GROQ_MODEL=llama-3.1-8b-instant on Vercel and Redeploy.`
    }
    if (/timed out|timeout|abort/i.test(detail)) {
      return 'Groq timed out. Click Regenerate once more (usually works on retry).'
    }
    if (/empty\/too-short|draft too short/i.test(detail)) {
      return `Groq returned a stub while following your direction (${detail.slice(0, 100)}). Try a shorter instruction and Regenerate again.`
    }
    if (/kept your previous draft/i.test(detail)) {
      return `Could not apply that direction (${detail.slice(0, 120)}). Your previous draft was kept — try a clearer instruction.`
    }
    if (/weak|fluff|rejected/i.test(detail)) {
      return 'Script AI fell back. Stay on Groq and click Regenerate — each pass writes a fresh draft.'
    }
    if (detail) {
      return `Script AI failed (${detail.slice(0, 160)}). Stay on Groq and click Regenerate.`
    }
    return 'Script AI did not return a usable draft. Stay on Groq and Regenerate (or check GROQ_API_KEY on Vercel).'
  }

  if (providers.xai) {
    return 'xAI Grok failed — usually no credits on your xAI team (console.x.ai). Add free GROQ_API_KEY on Vercel, pick Groq in Script AI, and Generate again.'
  }
  if (!providers.openai && !providers.groq && !providers.anthropic) {
    return 'No working AI script provider. Set free GROQ_API_KEY at console.groq.com → Vercel env → Redeploy.'
  }
  return 'AI script providers failed — using a built-in fallback draft. Check API keys and billing.'
}

/** Infer which provider owned the last failure (from tagged or raw error text). */
function classifyScriptFailureProvider(detail) {
  const d = String(detail || '')
  if (!d) return null
  // Prefer explicit [provider] tags from the draft loop
  const tagged = /\[(groq|openai|xai|anthropic|claude)\]/gi.exec(d)
  if (tagged) {
    const id = tagged[1].toLowerCase()
    return id === 'claude' ? 'anthropic' : id
  }
  if (/xai|grok-|\bGrok\b|console\.x\.ai|team doesn't have any credits/i.test(d)) return 'xai'
  if (/anthropic|claude-|api\.anthropic/i.test(d)) return 'anthropic'
  if (/groq|api\.groq|llama-3|gpt-oss-20b/i.test(d)) return 'groq'
  if (/openai|api\.openai|gpt-4/i.test(d)) return 'openai'
  return null
}

const DRAFT_FLUFF_RE =
  /here'?s what we know so far|the result or move that matters|why clubs and fans care|just another chapter|global superstar energy|rewrote elite|unforgettable nights|raw talent|most fans still miss|it is important to note|throughout (his|her|their|the) (career|history)|in conclusion|as we all know|the beautiful game of|a testament to|indelible mark|woven into the fabric|cannot be overstated|in today'?s footballing landscape/i

/**
 * Local hard gates (hot-take + directness + factuality + relevance).
 * Used by softBest fallthrough, directed rewrites, and Adapt — never silent-pass bollox.
 * @param {string} draft
 * @param {{ topic?: string, format?: string, deskBrief?: string, context?: string, mode?: string }} [opts]
 *   mode: 'adapt' — trust football cast already named in the approved draft (still blocks Fury/Keegan pivots)
 */
export function scoreLocalScriptGates(draft, opts = {}) {
  const format = opts.format || ''
  const topic = opts.topic || ''
  const orderedTopic = opts.orderedTopic || topic
  const deskBrief = String(opts.deskBrief || opts.context || '')
  const mode = opts.mode || ''
  const hot = scoreDraftHotTake(draft, { format, topic: orderedTopic })
  const direct = scoreDraftDirectness(draft, { format, topic: orderedTopic })
  const fact = scoreDraftFactuality(draft, {
    format,
    topic: orderedTopic,
    deskBrief,
  })
  const rel = scoreDraftRelevance(draft, {
    format,
    topic: orderedTopic,
    orderedTopic,
    deskBrief,
    mode,
  })
  const pass = Boolean(hot.pass && direct.pass && fact.pass && rel.pass)
  const reasons = [
    ...(rel.reasons || []),
    ...(fact.reasons || []),
    ...(hot.reasons || []),
    ...(direct.reasons || []),
  ]
  return { pass, hot, direct, fact, rel, reasons: reasons.slice(0, 8) }
}

/** Prefer punchy Shorts VO — reject fluff, stubs, invented news, and off-topic free-association. */
function isWeakDraft(text, format = '', topic = '', deskBrief = '', orderedTopic = '') {
  const t = String(text || '').trim()
  const words = t.split(/\s+/).filter(Boolean).length
  if (words < 45) return true
  if (words > 280) return true
  if (DRAFT_FLUFF_RE.test(t)) return true
  if (/\bsoccer\b/i.test(t)) return true
  if (/\b(NFL|NBA|MLB|NHL)\b/.test(t)) return true
  const gates = scoreLocalScriptGates(t, {
    format,
    topic,
    orderedTopic: orderedTopic || topic,
    deskBrief,
  })
  if (!gates.pass) return true
  if (!gates.direct.pass && gates.direct.score < 5.5) return true
  return false
}

/** Map gate failure → what the user should do next (not a generic “everything failed”). */
function actionableHintForGateReason(why = '', gates = null) {
  const w = String(why || '')
  if (/No concrete stake/i.test(w)) {
    return 'Add a pride/personal reason, criticism/backlash angle, or a sourced quote row (not only tactics/selection).'
  }
  if (/Sensitive personal|disability detail/i.test(w)) {
    return 'Add a quote or source for the personal/family angle in the desk brief, or drop that detail.'
  }
  if (/Topic drift|Off-topic|not grounded/i.test(w)) {
    return 'Stay on the ordered football story — no Keegan/Fury/unrelated free-association.'
  }
  if (/invent|fabricat|transfer|retirement|comeback|injur|sack/i.test(w)) {
    return 'Stick to the desk brief — do not invent transfers, retirements, or breaking news.'
  }
  if (/Insult|abusive/i.test(w)) {
    return 'Rewrite without insulting the viewer.'
  }
  if (/template|paste|glue/i.test(w)) {
    return 'Rewrite as a spoken hot take — kill canned “fans are arguing” glue.'
  }
  const hint =
    gates?.hot?.rewriteHints?.[0] ||
    gates?.rel?.rewriteHints?.[0] ||
    gates?.fact?.rewriteHints?.[0] ||
    gates?.direct?.rewriteHints?.[0]
  return hint ? String(hint) : 'Fix the topic, add a source/quote, or click Regenerate.'
}

function buildScriptGateRejectError(topic, gates, failures = []) {
  const why =
    gates?.reasons?.[0] ||
    gates?.rel?.reasons?.[0] ||
    gates?.fact?.reasons?.[0] ||
    gates?.hot?.reasons?.[0] ||
    'failed local quality gates (relevance / factuality / hot-take)'
  const hint = actionableHintForGateReason(why, gates)
  const extra = Array.isArray(failures) && failures.length ? ` ${failures.slice(0, 2).join(' · ')}` : ''
  return `Could not write a usable Shorts script for “${String(topic || '').slice(0, 60)}”: ${why}. Next: ${hint}${extra}`
}

/** Accept almost any real AI draft over the canned template. */
function isUsableAiDraft(text) {
  const t = String(text || '').trim()
  return wordCount(t) >= 35
}

/** Token Jaccard similarity 0–1 — catch near-duplicate regenerations. */
export function draftSimilarity(a, b) {
  const tok = (s) =>
    new Set(
      String(s || '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 2),
    )
  const A = tok(a)
  const B = tok(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  for (const w of A) if (B.has(w)) inter += 1
  return inter / (A.size + B.size - inter)
}

/** Fix common Shorts draft gaps instead of throwing the draft away. */
function normalizeAiDraft(text, topic) {
  let t = cleanDraftText(text)
  if (!t) return t
  t = t.replace(/\bsoccer\b/gi, 'football')
  // Ensure a comment CTA — missing "?" used to falsely fail the quality gate
  if (!/[?]/.test(t)) {
    const hook = String(topic || 'this')
      .replace(/[“”"]/g, '')
      .split(/\s+/)
      .slice(0, 6)
      .join(' ')
    t = `${t.replace(/[.!\s]+$/, '')}. Agree or disagree on ${hook || 'this'}? Comment.`
  }
  return t.trim()
}

function groqModelCandidates() {
  const preferred = envKey('GROQ_MODEL', 'EOF_GROQ_MODEL')
  const defaults = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-20b']
  if (!preferred) return defaults
  return [preferred, ...defaults.filter((m) => m !== preferred)]
}

function isRetryableGroqModelError(err) {
  const msg = String(err?.message || err || '')
  return /404|400|decommissioned|model_not_found|does not exist|invalid.?model|unknown.?model|not.?currently.?supported/i.test(msg)
}

function isRetryableGroqRateError(err) {
  const msg = String(err?.message || err || '')
  return /429|rate.?limit|too many requests|tokens per (minute|day)|TPM|TPD/i.test(msg)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
}

/**
 * Groq sometimes wraps the VO in JSON / markdown / "Here's the script:".
 * Pull the spoken prose out so we don't treat wrappers as an empty draft.
 */
export function cleanDraftText(text) {
  let t = String(text || '').trim()
  if (!t) return ''
  t = t.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim()
  t = t.replace(/^(?:script|narration|voiceover|draft)\s*:\s*/i, '').trim()

  // Accidental JSON object from the writer
  if (/^\s*\{/.test(t) && /"\s*:\s*"/.test(t)) {
    try {
      const parsed = parseJsonContent(t)
      const picked =
        parsed?.plainTextDraft ||
        parsed?.script ||
        parsed?.narration ||
        parsed?.voiceover ||
        parsed?.draft ||
        parsed?.text ||
        ''
      if (String(picked).trim().length >= 40) t = String(picked).trim()
    } catch {
      /* keep raw */
    }
  }

  // Strip common LLM preambles
  t = t
    .replace(
      /^(?:sure[!.,]?\s*|here(?:'s| is)\s+(?:a|the|your)\s+(?:shorts?\s+)?(?:script|voiceover|narration|draft)[:\s]*)+/i,
      '',
    )
    .trim()
  return t
}

async function groqChatText({ system, user, temperature = 0.4, timeoutMs = 45000 }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  if (!key) throw new Error('GROQ_API_KEY is not set')
  let lastErr
  for (const model of groqModelCandidates()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await chatTextCompletion({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          headers: { Authorization: `Bearer ${key}` },
          body: {
            model,
            temperature,
            max_tokens: 900,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          },
          timeoutMs,
        })
      } catch (e) {
        lastErr = e
        console.warn(
          '[eof-script] groq text model failed',
          model,
          `try ${attempt + 1}`,
          e instanceof Error ? e.message : e,
        )
        if (isRetryableGroqRateError(e) && attempt === 0) {
          await sleep(1200)
          continue
        }
        if (isRetryableGroqModelError(e)) break // next model
        if (isRetryableGroqRateError(e)) break // next model
        throw e
      }
    }
  }
  throw lastErr || new Error('Groq text completion failed')
}

async function groqChatJson({ system, user, temperature = 0.25, timeoutMs = 45000 }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  if (!key) throw new Error('GROQ_API_KEY is not set')
  let lastErr
  for (const model of groqModelCandidates()) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await chatJsonCompletion({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          headers: { Authorization: `Bearer ${key}` },
          body: {
            model,
            temperature,
            max_tokens: 1200,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          },
          timeoutMs,
        })
      } catch (e) {
        lastErr = e
        console.warn(
          '[eof-script] groq json model failed',
          model,
          `try ${attempt + 1}`,
          e instanceof Error ? e.message : e,
        )
        if (isRetryableGroqRateError(e) && attempt === 0) {
          await sleep(1200)
          continue
        }
        if (isRetryableGroqModelError(e) || isRetryableGroqRateError(e)) break
        throw e
      }
    }
  }
  throw lastErr || new Error('Groq JSON completion failed')
}

/**
 * Step 1 — continuous plain-text narration (editable in the UI).
 * Vague topics like "world cup news" are resolved into a concrete headline first.
 * @param {{ topic: string, format?: string, context?: string, scriptProvider?: string, regenerate?: boolean, previousDraft?: string }} input
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

function finalizeAiDraft(ai, topic, resolvedTopic) {
  const plainTextDraft = normalizeAiDraft(ai?.plainTextDraft, topic)
  if (!plainTextDraft || !isUsableAiDraft(plainTextDraft)) return null
  return {
    ...ai,
    plainTextDraft,
    title: ai.title || titleFromDraft(topic, plainTextDraft) || topic.slice(0, 90),
    resolvedTopic,
  }
}

export async function writeEofPlainTextDraft({
  topic,
  format,
  context,
  scriptProvider,
  regenerate = false,
  previousDraft = '',
  directorNote = '',
  qualityBar = 'standard',
} = {}) {
  const rawTopic = String(topic || '').trim()
  if (rawTopic.length < 2) throw new Error('Topic is required (min 2 characters).')
  const fmt = resolveFormat(format)
  const prev = String(previousDraft || '').trim()
  const note = String(directorNote || '').trim().slice(0, 1200)
  const autoMode = isAutoScriptMode(scriptProvider)

  // Fail fast with an actionable message instead of the generic "failed local quality
  // gates" error — that message is misleading when the real cause is zero configured
  // writers (the template fallback then also gets hard-rejected by the same gates).
  if (!resolveScriptProviderAttemptOrder(scriptProvider).length) {
    throw new Error(
      `No AI script provider is configured for "${rawTopic}". Set ANTHROPIC_API_KEY (Claude), ` +
        'GROQ_API_KEY (free), OPENAI_API_KEY, or an xAI key on Vercel, redeploy, then Regenerate.',
    )
  }
  const tuned = autoTuneDraftSettings({
    format: fmt,
    regenerate,
    directorNote: note,
    qualityBar,
  })
  const draftTemperature = tuned.draftTemperature
  const polishTemperature = tuned.polishTemperature
  const excellentMin = tuned.excellentMin
  const productionBar = tuned.production
  if (autoMode || productionBar) {
    console.info(
      '[eof-script] auto tune',
      fmt,
      'temp',
      draftTemperature,
      'excellent≥',
      excellentMin,
      productionBar ? 'qualityBar=production' : '',
    )
  }

  let t = rawTopic
  let ctx = String(context || '').trim()
  let resolvedTopic = null
  let deskSources = null

  // Quote Shorts: source an attributed quote first (BBC/Sky/presser/desks)
  if (fmt === 'quote') {
    try {
      const sourced = await withBudget(sourceEofFootballQuote({ topic: rawTopic, format: fmt }), 55000, 'quote source')
      if (sourced?.quote) {
        const headline = quoteHitToHeadline(sourced.quote)
        if (headline) {
          t = headline
          resolvedTopic = headline
        }
        ctx = [ctx, quoteHitToContext(sourced.quote)].filter(Boolean).join('\n\n')
        console.info('[eof-script] quote sourced via', sourced.source, sourced.quote.speaker)
      }
    } catch (e) {
      console.warn('[eof-script] quote source skipped', e instanceof Error ? e.message : e)
    }
  } else {
    try {
      const brief = await withBudget(
        resolveEofScriptBrief({ topic: rawTopic, format: fmt, scriptProvider }),
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
  }

  // Free live sourcing: NewsData.io + Guardian + BBC/Sky/Guardian RSS
  // Normalize common typos (Cuccorea → Cucurella) for search + known-story seeds.
  const searchTopic = normalizeFootballTopicQuery(t) || t
  let headlinesText = ''
  try {
    const pack = await withBudget(
      fetchFreeFootballDeskPack({ topic: searchTopic, limit: 8 }),
      15000,
      'free desk pack',
    )
    headlinesText = pack.text || ''
    deskSources = pack.sources || null
    if (headlinesText) {
      console.info('[eof-script] free desk pack', pack.sources)
    } else if (pack.sources?.newsdataConfigured && pack.sources.newsdata === 0) {
      console.warn('[eof-script] NewsData keyed but returned 0 articles for', searchTopic.slice(0, 60))
    }
  } catch (e) {
    console.warn('[eof-script] free desk pack skipped', e instanceof Error ? e.message : e)
    try {
      const headlines = await withBudget(
        fetchFootballDeskHeadlines({ topic: searchTopic, limit: 8 }),
        12000,
        'desk RSS',
      )
      headlinesText = formatDeskHeadlinesForPrompt(headlines)
      deskSources = {
        newsdata: 0,
        guardian: 0,
        rss: headlines?.length || 0,
        newsdataConfigured: isNewsdataConfigured(),
        guardianConfigured: isGuardianConfigured(),
      }
    } catch (e2) {
      console.warn('[eof-script] desk RSS skipped', e2 instanceof Error ? e2.message : e2)
    }
  }

  // If live pack is empty, still ground known human-interest topics (hair/son etc.).
  if (!String(headlinesText || '').trim()) {
    const known = seedKnownDeskNotesForTopic(searchTopic || rawTopic)
    if (known) {
      headlinesText = known
      deskSources = { ...(deskSources || {}), knownSeed: true }
    }
  }

  // Paid Perplexity only when EOF_USE_PERPLEXITY=1
  if (shouldUsePerplexity()) {
    try {
      const px = await withBudget(
        researchFootballTopicWithPerplexity({ topic: t, format: fmt }),
        45000,
        'perplexity research',
      )
      const pxText = formatPerplexityResearchForPrompt(px)
      if (pxText) {
        headlinesText = [pxText, headlinesText].filter(Boolean).join('\n\n')
        console.info('[eof-script] perplexity citations', px?.citations?.length || 0)
      }
    } catch (e) {
      console.warn('[eof-script] perplexity research skipped', e instanceof Error ? e.message : e)
    }
  }

  const order = resolveScriptProviderAttemptOrder(scriptProvider)
  // Auto: draft with first writer, escalate rewrites to remaining writers for best score
  const primaryOrder = autoMode ? order.slice(0, 1) : order
  const escalateOrder = autoMode ? order.slice(1) : []

  const attempts = []
  for (const id of primaryOrder) {
    if (id === 'xai' || id === 'openai' || id === 'groq' || id === 'anthropic') {
      attempts.push({
        id,
        run: () =>
          writeDraftPipeline({
            provider: id,
            topic: t,
            format: fmt,
            context: ctx,
            headlinesText,
            temperature: draftTemperature,
            polishTemperature,
            previousDraft: prev,
            regenerate: regenerate || Boolean(note),
            directorNote: note,
            forceHotTakeRefine: productionBar || autoMode,
          }),
      })
    }
  }

  const failures = []
  let softBest = null
  const deskBriefForJudge = [ctx, headlinesText].filter(Boolean).join('\n\n')

  async function scoreAndMaybeKeep(ai, writerId) {
    let judge = null
    try {
      judge = await withBudget(
        judgeEofScriptDraft({
          topic: rawTopic || t,
          draft: ai.plainTextDraft,
          format: fmt,
          deskBrief: deskBriefForJudge,
          writerProvider: writerId,
        }),
        45000,
        `${writerId} judge`,
      )
    } catch (e) {
      console.warn('[eof-script] judge failed', writerId, e instanceof Error ? e.message : e)
      // Never auto-accept on judge API errors — local gates still block waffle / invented news / off-topic.
      const gates = scoreLocalScriptGates(ai.plainTextDraft, {
        format: fmt,
        topic: t,
        orderedTopic: rawTopic,
        deskBrief: deskBriefForJudge,
      })
      judge = {
        skipped: false,
        pass: gates.pass,
        overall: Math.min(gates.direct.score, gates.hot.score, gates.fact.score, gates.rel.score),
        merit: Math.min(gates.direct.score, gates.fact.score, gates.rel.score),
        interest: gates.hot.score,
        value: Math.min(gates.direct.score, gates.rel.score),
        directness: gates.direct.score,
        hotTake: gates.hot.score,
        factuality: gates.fact.score,
        relevance: gates.rel.score,
        reasons: [
          'Judge API error — local directness + hot-take + factuality + relevance gates',
          ...gates.reasons,
        ].slice(0, 8),
        rewriteHints: [
          ...(gates.direct.rewriteHints || []),
          ...(gates.hot.rewriteHints || []),
          ...(gates.fact.rewriteHints || []),
          ...(gates.rel.rewriteHints || []),
        ].slice(0, 7),
        judgeProvider: 'local-directness+hot-take+factuality+relevance',
        threshold: 6.5,
      }
    }
    const candidate = {
      ...ai,
      deskSources,
      judge: judge?.skipped ? null : judge,
      autoMode,
      autoTuned: autoMode
        ? { draftTemperature, polishTemperature, excellentMin, format: fmt }
        : null,
    }
    if (
      !softBest ||
      judgeOverall(judge) > judgeOverall(softBest.judge) ||
      (!softBest.judge && judge && !judge.skipped)
    ) {
      softBest = candidate
    }
    return { candidate, judge }
  }

  async function rewriteWithFeedback(writerId, baseDraft, judge, temperatureBoost = 0.12) {
    const rewriteCtx = appendJudgeFeedbackToContext(ctx, judge)
    const rewritten = await withBudget(
      writeDraftPipeline({
        provider: writerId,
        topic: t,
        format: fmt,
        context: rewriteCtx,
        headlinesText,
        temperature: Math.min(0.85, draftTemperature + temperatureBoost),
        polishTemperature,
        previousDraft: baseDraft,
        regenerate: true,
        directorNote: note
          ? `${note}\n\nAlso fix the editor judge feedback above.`
          : autoMode
            ? 'Auto quality pass: HOT TAKE desk VO — name who said what / who hit back, concrete stake (tactics/selection/pride/result/quote/personal reason/backlash), cut waffle, sharper CTA. Stay inside the desk brief. No article paste.'
            : '',
        forceHotTakeRefine: true,
      }),
      90000,
      `${writerId} quality-rewrite`,
    )
    return finalizeAiDraft(rewritten, t, resolvedTopic)
  }

  for (const { id, run } of attempts) {
    try {
      const raw = await withBudget(run(), 90000, `${id} draft pipeline`)
      let ai = finalizeAiDraft(raw, t, resolvedTopic)
      if (!ai) {
        failures.push(`[${id}] empty/too-short draft`)
        console.warn('[eof-script] draft empty/short', id, raw?.plainTextDraft?.slice?.(0, 80))
        // Keep near-misses so we don't fall all the way to the canned template
        const almost = normalizeAiDraft(raw?.plainTextDraft, t)
        if (wordCount(almost) >= 28) {
          softBest =
            softBest ||
            {
              plainTextDraft: almost,
              title: titleFromDraft(t, almost),
              source: id,
              resolvedTopic,
              deskSources,
            }
        }
        continue
      }
      // Producer chat direction: still hard-gate relevance / drift / factuality (no silent bollox).
      if (note && wordCount(ai.plainTextDraft) >= 35) {
        if (isWeakDraft(ai.plainTextDraft, fmt, t, deskBriefForJudge, rawTopic)) {
          softBest = softBest || { ...ai, deskSources }
          // One clearer-brief rewrite before abandoning this writer (still refuse bollox).
          try {
            const failGates = scoreLocalScriptGates(ai.plainTextDraft, {
              format: fmt,
              topic: t,
              orderedTopic: rawTopic,
              deskBrief: deskBriefForJudge,
            })
            const rewrittenAi = await rewriteWithFeedback(
              id,
              ai.plainTextDraft,
              {
                pass: false,
                skipped: false,
                reasons: [
                  'CLEARER BRIEF RETRY — fix local gates',
                  ...(failGates.reasons || []).slice(0, 4),
                  actionableHintForGateReason(failGates.reasons?.[0], failGates),
                ].slice(0, 7),
                rewriteHints: [
                  'Stay on the ordered topic — pride / personal reason / criticism / backlash / quote row count as stake for human-interest stories',
                  'Do NOT invent transfers/retirements/injuries; do NOT pivot to Keegan/Fury/boxing',
                  ...(failGates.hot?.rewriteHints || []),
                  ...(failGates.rel?.rewriteHints || []),
                  'Name who + conflict + one concrete stake + one CTA',
                ].slice(0, 6),
                overall: 4,
                threshold: 6.5,
              },
              0.1,
            )
            if (
              rewrittenAi &&
              !isWeakDraft(rewrittenAi.plainTextDraft, fmt, t, deskBriefForJudge, rawTopic)
            ) {
              console.info(
                '[eof-script] accepted directed draft after gate retry',
                id,
                wordCount(rewrittenAi.plainTextDraft),
                'words',
              )
              return {
                ...rewrittenAi,
                deskSources,
                judge: null,
                directed: true,
                gateRetry: true,
                autoMode,
                autoTuned: autoMode
                  ? { draftTemperature, polishTemperature, excellentMin, format: fmt }
                  : null,
              }
            }
          } catch (e) {
            console.warn(
              '[eof-script] directed gate retry failed',
              id,
              e instanceof Error ? e.message : e,
            )
          }
          failures.push(`[${id}] directed draft failed local gates`)
          console.warn('[eof-script] directed draft soft-weak', id, ai.plainTextDraft.slice(0, 80))
          continue
        }
        console.info('[eof-script] accepted directed draft', id, wordCount(ai.plainTextDraft), 'words')
        return {
          ...ai,
          deskSources,
          judge: null,
          directed: true,
          autoMode,
          autoTuned: autoMode
            ? { draftTemperature, polishTemperature, excellentMin, format: fmt }
            : null,
        }
      }
      if (prev && draftSimilarity(prev, ai.plainTextDraft) >= 0.72 && !note) {
        failures.push(`[${id}] too similar to previous draft`)
        console.warn('[eof-script] draft too similar to previous', id)
        softBest = softBest || { ...ai, deskSources }
        continue
      }
      if (isWeakDraft(ai.plainTextDraft, fmt, t, deskBriefForJudge, rawTopic)) {
        softBest = softBest || { ...ai, deskSources }
        failures.push(`[${id}] soft-weak draft kept as candidate`)
        console.warn('[eof-script] draft soft-weak, keeping as candidate', id, ai.plainTextDraft.slice(0, 80))
        continue
      }

      let { candidate, judge } = await scoreAndMaybeKeep(ai, id)

      // Same-writer rewrite if judge fails
      if (judge && !judge.skipped && !judge.pass) {
        failures.push(
          `[${id}] judge fail ${judge.overall}/10 (m${judge.merit} i${judge.interest} v${judge.value})`,
        )
        try {
          const rewrittenAi = await rewriteWithFeedback(id, ai.plainTextDraft, judge, 0.12)
          if (rewrittenAi && !isWeakDraft(rewrittenAi.plainTextDraft, fmt, t, deskBriefForJudge, rawTopic)) {
            ;({ candidate, judge } = await scoreAndMaybeKeep(rewrittenAi, id))
            if (judge && !judge.skipped && judge.pass && (!autoMode || isExcellentJudge(judge, excellentMin))) {
              return candidate
            }
          }
        } catch (e) {
          console.warn('[eof-script] judge rewrite failed', id, e instanceof Error ? e.message : e)
        }
      } else if (!autoMode || isExcellentJudge(judge, excellentMin)) {
        return candidate
      } else if (autoMode && judge && !judge.skipped) {
        failures.push(`[${id}] auto escalate — ${judge.overall}/10 < excellent ${excellentMin}`)
      }

      // Auto: escalate to stronger writers until excellent or exhausted
      if (autoMode && escalateOrder.length) {
        let baseText = candidate?.plainTextDraft || ai.plainTextDraft
        let baseJudge = judge
        for (const nextId of escalateOrder) {
          if (nextId === 'xai' || nextId === 'openai' || nextId === 'groq' || nextId === 'anthropic') {
            try {
              console.info('[eof-script] auto escalate writer', id, '→', nextId)
              const escalated = await rewriteWithFeedback(
                nextId,
                baseText,
                baseJudge || {
                  pass: false,
                  skipped: false,
                  reasons: ['Auto quality: push for denser, more valuable football VO'],
                  rewriteHints: [
                    'First line: names + concrete claim or response',
                    'Use said / hit back / responded — no career essay',
                    'More concrete desk-brief facts',
                    'Do NOT invent transfers/retirements/comebacks/injuries/sackings',
                    'Sharper agree/disagree CTA',
                  ],
                  merit: 5,
                  interest: 5,
                  value: 5,
                  overall: 5,
                  threshold: excellentMin,
                },
                0.08,
              )
              if (!escalated || isWeakDraft(escalated.plainTextDraft, fmt, t, deskBriefForJudge, rawTopic)) {
                continue
              }
              const scored = await scoreAndMaybeKeep(escalated, nextId)
              baseText = scored.candidate.plainTextDraft
              baseJudge = scored.judge
              if (isExcellentJudge(scored.judge, excellentMin)) {
                return scored.candidate
              }
            } catch (e) {
              failures.push(`[${nextId}] escalate ${e instanceof Error ? e.message : e}`)
              console.warn('[eof-script] escalate failed', nextId, e instanceof Error ? e.message : e)
            }
          }
        }
      }

      if (candidate && judge?.pass) {
        // Never prefer an unscored softBest over a judged pass
        return candidate
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`[${id}] ${msg}`)
      console.warn('[eof-script] draft provider failed', id, msg)
    }
  }

  // Fall through: try remaining writers as full drafts (non-auto multi, or auto primary failed)
  if (!autoMode) {
    /* primaryOrder already covered all */
  } else if (!softBest && order.length > 1) {
    for (const id of order.slice(1)) {
      try {
        const raw = await withBudget(
          writeDraftPipeline({
            provider: id,
            topic: t,
            format: fmt,
            context: ctx,
            headlinesText,
            temperature: draftTemperature,
            polishTemperature,
            previousDraft: prev,
            regenerate: true,
            directorNote: note,
            forceHotTakeRefine: productionBar || autoMode,
          }),
          90000,
          `${id} auto-fallback draft`,
        )
        const ai = finalizeAiDraft(raw, t, resolvedTopic)
        if (!ai || isWeakDraft(ai.plainTextDraft, fmt, t, deskBriefForJudge, rawTopic)) continue
        const { candidate, judge } = await scoreAndMaybeKeep(ai, id)
        if (isExcellentJudge(judge, excellentMin) || judge?.pass) return candidate
      } catch (e) {
        failures.push(`[${id}] ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  if (softBest) {
    const gates = scoreLocalScriptGates(softBest.plainTextDraft, {
      format: fmt,
      topic: t,
      orderedTopic: rawTopic,
      deskBrief: deskBriefForJudge,
    })
    if (!gates.pass || softBest.source === 'template') {
      // Production + Script Maker + Order script: never silent-pass drift / Fury / insults.
      failures.push(
        `softBest rejected: ${gates.reasons[0] || 'failed local quality gates'}`,
      )
    } else {
      return {
        ...softBest,
        deskSources: softBest.deskSources || deskSources,
        qualityBar: productionBar ? 'production' : 'standard',
        stages: ['research', 'draft', 'polish', 'hot-take-refine', 'judge'],
        judge: softBest.judge || {
          pass: true,
          skipped: false,
          overall: Math.min(gates.rel.score, gates.fact.score, gates.hot.score, gates.direct.score),
          reasons: ['Accepted after local gates (softBest)'],
          judgeProvider: 'local-directness+hot-take+factuality+relevance',
        },
      }
    }
  }

  // Keep previous only when it still passes local gates (never re-ship Keegan/Fury bollox).
  if (prev && wordCount(prev) >= 40) {
    const prevGates = scoreLocalScriptGates(prev, {
      format: fmt,
      topic: t,
      orderedTopic: rawTopic,
      deskBrief: deskBriefForJudge,
    })
    if (prevGates.pass) {
      return {
        plainTextDraft: prev,
        title: titleFromDraft(t, prev) || t.slice(0, 90),
        source: 'previous',
        resolvedTopic,
        deskSources,
        failureDetail: failures.length
          ? `${failures.join(' · ')} — kept your previous draft`
          : 'AI rewrite failed — kept your previous draft',
        keptPrevious: true,
      }
    }
  }

  throw new Error(
    buildScriptGateRejectError(
      rawTopic || t,
      softBest
        ? scoreLocalScriptGates(softBest.plainTextDraft, {
            format: fmt,
            topic: t,
            orderedTopic: rawTopic,
            deskBrief: deskBriefForJudge,
          })
        : { reasons: failures.slice(0, 2) },
      failures,
    ),
  )
}

/**
 * Step 2 — split approved plain text into Short scenes.
 * @param {{ plainTextDraft: string, topic: string, format?: string }} input
 */
export async function adaptEofPlainTextToScenes({
  plainTextDraft,
  topic,
  format,
  scriptProvider,
  /** Skip AI relevance/factuality/drift gates entirely for a user-authored ("post your own script") draft — the writer owns the content and topic themselves. */
  isManualScript = false,
}) {
  const draft = String(plainTextDraft || '').trim()
  if (draft.length < 40) throw new Error('Plain-text draft is too short — write or generate a fuller script first.')
  const t = String(topic || '').trim() || 'Football'
  const fmt = resolveFormat(format)

  // Adapt trusts the approved draft's football cast (Bergvall et al.) — still blocks Fury/Keegan pivots.
  // Manual/own scripts skip this gate entirely — same as script creation, which never runs it either.
  if (!isManualScript) {
    const adaptGates = scoreLocalScriptGates(draft, {
      format: fmt,
      topic: t,
      orderedTopic: t,
      mode: 'adapt',
    })
    if (!adaptGates.pass) {
      throw new Error(
        `Cannot adapt this draft — ${adaptGates.reasons[0] || 'failed relevance/factuality gates'}. Fix or Regenerate the script first.`,
      )
    }
  }

  // Faithful, deterministic split FIRST — keeps the approved script's exact words and
  // ties every scene image to the named player/club. AI paraphrase tends to butcher a
  // good draft, so we only fall back to it when the draft can't be split cleanly.
  const local = adaptPlainTextDraftToScenesLocally({ plainTextDraft: draft, topic: t, format: fmt })
  if (local?.scenes?.length >= 3) {
    return { script: local, source: 'local-split' }
  }

  const order = resolveScriptProviderAttemptOrder(scriptProvider)
  const attempts = []
  for (const id of order) {
    if (id === 'xai') attempts.push(() => adaptWithXai({ draft, topic: t, format: fmt }))
    if (id === 'openai') attempts.push(() => adaptWithOpenAi({ draft, topic: t, format: fmt }))
    if (id === 'anthropic') attempts.push(() => adaptWithAnthropic({ draft, topic: t, format: fmt }))
    if (id === 'groq') attempts.push(() => adaptWithGroq({ draft, topic: t, format: fmt }))
  }

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
export async function writeEofProductionScript({ topic, format, context, scriptProvider, qualityBar = 'production' }) {
  const draftResult = await writeEofPlainTextDraft({
    topic,
    format,
    context,
    scriptProvider,
    qualityBar,
  })
  const resolvedTopic = draftResult.resolvedTopic || topic
  const adapted = await adaptEofPlainTextToScenes({
    plainTextDraft: draftResult.plainTextDraft,
    topic: resolvedTopic,
    format,
    scriptProvider,
  })
  if (adapted?.script) {
    adapted.script.plainTextDraft = draftResult.plainTextDraft
    adapted.script.topic = resolvedTopic
    if (!adapted.script.title && draftResult.title) adapted.script.title = draftResult.title
    if (adapted.source === 'template' && draftResult.source && draftResult.source !== 'template') {
      adapted.source = draftResult.source
    }
  }
  return { ...adapted, resolvedTopic, failureDetail: draftResult.failureDetail || '' }
}

/** Merge desk context + live headlines so Claude always has source bullets as primary truth. */
export function assembleWriterDeskContext({ context = '', headlinesText = '', researchBrief = '' } = {}) {
  const parts = []
  const ctx = String(context || '').trim()
  const research = String(researchBrief || '').trim()
  const headlines = String(headlinesText || '').trim()
  if (ctx) parts.push(ctx)
  if (research) parts.push(`DESK BRIEF (editor):\n${research}`)
  if (headlines) {
    parts.push(`SOURCE HEADLINES / FACTS (PRIMARY TRUTH — only claim what appears here):\n${headlines}`)
  }
  return parts.join('\n\n').trim()
}

const WRITER_SYSTEM_HARD_LOCKS = `HARD FACT LOCK (non-negotiable):
- The DESK BRIEF / SOURCE HEADLINES are the ONLY allowed facts.
- ONLY claim names, scores, clubs, fees, quotes, and career-status changes that appear there (or mark as opinion/question).
- Do NOT invent transfers, retirements, comebacks, injuries, sackings, appointments, bans, or "breaking" claims.

HARD TOPIC LOCK (non-negotiable):
- Football worldwide only — call it football, never soccer. Never NFL / American football.
- Stay inside THIS story. No boxing (Fury/Joshua), F1, UFC, tennis, NBA, Hollywood, or other cross-sport free-association unless already in the brief.
- Named people must be grounded in the topic/brief (same-story cast only).

VOICE / CTA:
- Eyes Of Football desk — Sky Sports / BBC Sport energy. Hot, sharp, direct. No bollox waffle.
- ONE fight CTA question at the end. No agree/disagree spam. Never insult the viewer.`

/**
 * Writer input bundle for draft / polish / refine prompts (testable).
 * Ensures Claude always receives topic, desk brief, duration, voice, and hard locks.
 */
export function buildDraftPrompt({
  topic,
  format,
  context,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
}) {
  const angles = [
    'lead with the result and what it means next',
    'lead with the quote or claim, then the pushback',
    'lead with the tactical / selection angle',
    'lead with the fan / dressing-room reaction',
    'lead with the timeline — what just changed today',
  ]
  const angle = angles[Math.floor(Date.now() / 1000) % angles.length]
  const note = String(directorNote || '').trim().slice(0, 1200)
  const prev = String(previousDraft || '').trim()
  const desk = String(context || '').trim().slice(0, 2800)
  const fmt = resolveFormat(format)

  const system = `You write YouTube SHORTS voiceovers for Eyes Of Football — NOT articles, NOT book chapters, NOT news wire paste.

HARD SCOPE:
${EOF_FOOTBALL_SCOPE}

OUTPUT = ONE continuous spoken script. Plain prose only. No JSON, bullets, scene labels, hashtags, or titles.

${WRITER_SYSTEM_HARD_LOCKS}

${EOF_SHORTS_DIRECT_VOICE}

${EOF_SHORTS_HOT_TAKE_VOICE}

${EOF_SHORTS_FACTUALITY_VOICE}

${EOF_SHORTS_RELEVANCE_VOICE}

SHORTS LENGTH / FORMAT:
- 90–130 words. Spoken in ~35–45 seconds. If you write more, cut it.
- Short sentences. Average under 16 words. Max one clause per beat.
- FIRST SENTENCE must name the player/coach AND the claim or conflict.
- Transform the desk brief into a spoken ARGUMENT. Never copy-paste an article.
- If PRODUCER DIRECTION is provided, follow it closely while keeping Shorts length and fact lock.
- Structure for format "${fmt}": ${draftFormatGuide(fmt)}

BANNED forever:
"here's what we know so far", "the key detail fans need", "why it matters for the club", "just another chapter", "global superstar energy", "raw talent", "unforgettable nights", "most fans still miss", "it is important to note", "throughout his career", "in conclusion", "as we all know", "a testament to", "indelible mark", "woven into the fabric", "cannot be overstated", "in today's footballing landscape", "raises questions", "speaks volumes", "a reminder that", "the narrative", "the journey", "fans are arguing about right now", "ignore the noise", "strip the noise", "that is the football story", "you nut job", "you idiot", literary metaphors, long subordinate clauses, cross-sport free-association not in the brief.
Never reply with meta chat ("Sure", "I'll rewrite", "Here is a plan"). Output the FULL voiceover only.`

  // Directed rewrite: keep the prompt lean so Groq free tier actually returns a full VO
  if (note) {
    const user = `## TOPIC
${topic}

## FORMAT / DURATION
${fmt} — ${draftFormatGuide(fmt)}
90–130 words (~35–45s). One continuous spoken VO.

## PRODUCER DIRECTION (must follow)
"""
${note}
"""
${prev ? `\n## CURRENT DRAFT (rewrite — do not copy sentence-by-sentence)\n"""\n${prev.slice(0, 700)}\n"""\n` : ''}
## DESK BRIEF / SOURCE FACTS (PRIMARY TRUTH — only claim what appears here)
${desk || '(none — invent NOTHING; cautious football commentary only)'}

## HARD CONSTRAINTS
- FACT LOCK + TOPIC LOCK: only the brief above. Football only. No Fury/Joshua/boxing free-association.
- ONE fight CTA. No agree/disagree spam. No viewer insults.

Write the FULL spoken Shorts voiceover now (90–130 words). Plain prose only. No preamble.`
    return { system, user }
  }

  const regenBlock =
    regenerate && prev
      ? `\n## REGENERATE — angle: ${angle}
Write a DIFFERENT voiceover: new opening line, new structure, new CTA question.
Keep the same verified facts from the DESK BRIEF. Do not paraphrase the previous draft sentence-by-sentence.
PREVIOUS DRAFT (avoid copying):\n"""\n${prev.slice(0, 700)}\n"""\n`
      : regenerate
        ? `\n## REGENERATE — angle: ${angle}. New opening line required. Stay inside the DESK BRIEF facts.\n`
        : ''

  const user = `## TOPIC
${topic}

## FORMAT / DURATION
${fmt} — ${draftFormatGuide(fmt)}
90–130 words (~35–45 seconds spoken). Short sentences. One continuous VO.

## VOICE
Eyes Of Football desk — hot, sharp, direct. Football only. ONE fight CTA. No agree/disagree spam. No viewer insults.

## DESK BRIEF / SOURCE FACTS (PRIMARY TRUTH — only claim what appears here)
${
  desk ||
  '(none returned — do not invent scores, quotes, transfers, retirements, comebacks, injuries, or sackings; cautious commentary only.)'
}
${regenBlock}
## HARD CONSTRAINTS
- ONLY claim what is in the DESK BRIEF / SOURCE FACTS above.
- TOPIC LOCK: this football story only — no boxing/F1/unrelated celebs unless already in the brief.
- Output the spoken Shorts voiceover only. No preamble.`

  return { system, user }
}

export function buildPolishPrompt({ topic, format, draft, deskBrief = '' }) {
  const desk = String(deskBrief || '').trim().slice(0, 2800)
  const fmt = resolveFormat(format)
  const system = `You are a ruthless YouTube Shorts editor for Eyes Of Football.

Rewrite the draft into a DIRECT hot-take spoken voiceover. Keep EVERY name, score, club, and claim — do not invent new facts.

${WRITER_SYSTEM_HARD_LOCKS}

${EOF_SHORTS_DIRECT_VOICE}

${EOF_SHORTS_HOT_TAKE_VOICE}

${EOF_SHORTS_FACTUALITY_VOICE}

${EOF_SHORTS_RELEVANCE_VOICE}

Rules:
- 90–130 words. Cut every soft phrase, career waffle, and article glue.
- First line: names + the conflict (who hit back / what cost the win / what was just said).
- Add or sharpen ONE concrete stake: tactics, selection, pride, result, or quote row.
- Short spoken sentences. No book language.
- Always football, never soccer. Never NFL.
- Keep ONE fight CTA question at the end — no agree/disagree spam, no viewer insults.
- TOPIC LOCK: drop any athlete/sport/celebrity not in the DESK BRIEF (no boxing/F1 free-association).
- Do NOT invent transfers, retirements, comebacks, injuries, or sackings absent from the DESK BRIEF.
- Format intent: ${fmt}. ${draftFormatGuide(fmt)}
- Output the FULL improved voiceover only.`

  const user = `## TOPIC
${topic}

## FORMAT / DURATION
${fmt} — 90–130 words (~35–45s).

## DESK BRIEF / SOURCE FACTS (PRIMARY TRUTH — do not invent beyond)
${desk || '(none — invent NOTHING)'}

## DRAFT TO TIGHTEN
"""
${draft}
"""

Return only the improved FULL voiceover.`

  return { system, user }
}

export function buildHotTakeRefinePrompt({ topic, format, draft, deskBrief = '' }) {
  const desk = String(deskBrief || '').trim().slice(0, 2800)
  const fmt = resolveFormat(format)
  const system = `Final Eyes Of Football pass — HOT TAKE refine only.

You receive a draft that already passed a polish. Make it bite harder WITHOUT inventing facts.

${WRITER_SYSTEM_HARD_LOCKS}

${EOF_SHORTS_HOT_TAKE_VOICE}

${EOF_SHORTS_FACTUALITY_VOICE}

${EOF_SHORTS_RELEVANCE_VOICE}

Rules:
- Keep every verified name/score/club/claim from the draft AND desk brief.
- Line 1 must punch: who + conflict.
- Ensure a concrete stake (tactics / selection / pride / result / quote row / personal reason / backlash / criticism).
- Ensure a “now” signal (just / after / according to / hit back…) ONLY when the brief supports a live event — otherwise use opinion energy, not fake breaking news.
- Kill any remaining template glue, viewer insults, and agree/disagree spam.
- TOPIC LOCK: remove any cross-sport / unrelated celebrity injection not in the desk brief.
- Never invent retirements, comebacks, transfers, injuries, or sackings.
- 90–130 words. One CTA question.
- Format: ${fmt}.
- Output the FULL voiceover only.`

  const user = `## TOPIC
${topic}

## FORMAT / DURATION
${fmt} — 90–130 words (~35–45s).

## DESK BRIEF / SOURCE FACTS (PRIMARY TRUTH)
${desk || '(none — invent NOTHING)'}

## DRAFT
"""
${draft}
"""

Return the sharper FULL voiceover.`

  return { system, user }
}

/**
 * Multi-pass: research → draft → polish on one provider.
 * Groq free tier: one draft call only (desk headlines as brief) — research+polish burn rate limits
 * and often return empty/too-short wrappers.
 */
async function writeDraftPipeline({
  provider,
  topic,
  format,
  context,
  headlinesText,
  temperature = 0.45,
  polishTemperature = 0.3,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
  forceHotTakeRefine = false,
}) {
  let workingTopic = topic
  let researchCtx = assembleWriterDeskContext({ context, headlinesText })
  const isGroq = provider === 'groq'
  // Groq: never spend a JSON research call — use free desk pack / context only
  if (!isGroq) {
    try {
      const research = await researchDeskBriefWithProvider({
        provider,
        topic: workingTopic,
        format,
        context,
        headlinesText,
      })
      if (research) {
        const built = deskBriefToContext(research)
        if (built) {
          // Keep raw source headlines alongside the editor brief (primary truth).
          researchCtx = assembleWriterDeskContext({
            context,
            researchBrief: built,
            headlinesText,
          })
          if (research.headline && String(research.headline).trim().length >= 12) {
            workingTopic = String(research.headline).trim().slice(0, 100)
          }
        }
      }
    } catch (e) {
      console.warn('[eof-script] research pass skipped', provider, e instanceof Error ? e.message : e)
    }
  }

  const draftResult = await writeDraftWithProvider({
    provider,
    topic: workingTopic,
    format,
    context: researchCtx,
    temperature,
    previousDraft,
    regenerate,
    directorNote,
  })
  let text = draftResult.plainTextDraft
  // Production / Auto: always polish (including Groq) so we don't ship raw first drafts.
  const allowPolish =
    forceHotTakeRefine ||
    !isGroq ||
    String(process.env.EOF_GROQ_POLISH || '')
      .trim()
      .toLowerCase() === '1'
  if (allowPolish) {
    try {
      const polished = await polishDraftWithProvider({
        provider,
        topic: workingTopic,
        format,
        draft: text,
        temperature: polishTemperature,
        deskBrief: researchCtx,
      })
      const polishedWords = wordCount(polished)
      const draftWords = wordCount(text)
      // Only keep polish when it stays a real Shorts VO (not a short wrapper)
      if (
        polished &&
        polishedWords >= 40 &&
        polishedWords >= Math.floor(draftWords * 0.7) &&
        !(regenerate && previousDraft && draftSimilarity(previousDraft, polished) >= 0.78)
      ) {
        text = polished
      }
    } catch (e) {
      console.warn('[eof-script] polish pass skipped', provider, e instanceof Error ? e.message : e)
    }
  }

  // Stage 3 — hot-take refine (Auto / Script Maker / explicit)
  if (forceHotTakeRefine) {
    try {
      const refined = await hotTakeRefineWithProvider({
        provider,
        topic: workingTopic,
        format,
        draft: text,
        temperature: Math.min(0.4, polishTemperature + 0.08),
        deskBrief: researchCtx,
      })
      const refinedWords = wordCount(refined)
      const baseWords = wordCount(text)
      if (
        refined &&
        refinedWords >= 45 &&
        refinedWords >= Math.floor(baseWords * 0.7) &&
        scoreDraftHotTake(refined, { format, topic: workingTopic }).score >=
          scoreDraftHotTake(text, { format, topic: workingTopic }).score
      ) {
        text = refined
      }
    } catch (e) {
      console.warn('[eof-script] hot-take refine skipped', provider, e instanceof Error ? e.message : e)
    }
  }

  return {
    plainTextDraft: text,
    title: titleFromDraft(workingTopic, text),
    source: provider,
    stages: forceHotTakeRefine
      ? ['research', 'draft', 'polish', 'hot-take-refine']
      : ['research', 'draft', allowPolish ? 'polish' : null].filter(Boolean),
  }
}

async function researchDeskBriefWithProvider({ provider, topic, format, context, headlinesText }) {
  const system = buildDeskResearchSystemPrompt()
  const user = buildDeskResearchUserPrompt({ topic, format, context, headlinesText })
  if (provider === 'xai') {
    return xaiJsonCompletion({ system, user, temperature: 0.25 })
  }
  if (provider === 'openai') {
    const key = envKey('OPENAI_API_KEY')
    const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
    return chatJsonCompletion({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${key}` },
      body: {
        model,
        temperature: 0.25,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      timeoutMs: 45000,
    })
  }
  if (provider === 'anthropic') {
    return anthropicJsonCompletion({ system, user, temperature: 0.25 })
  }
  if (provider === 'groq') {
    return groqChatJson({ system, user, temperature: 0.25, timeoutMs: 40000 })
  }
  return null
}

async function writeDraftWithProvider({
  provider,
  topic,
  format,
  context,
  temperature = 0.45,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
}) {
  if (provider === 'xai') {
    return writeDraftWithXai({ topic, format, context, temperature, previousDraft, regenerate, directorNote })
  }
  if (provider === 'openai') {
    return writeDraftWithOpenAi({ topic, format, context, temperature, previousDraft, regenerate, directorNote })
  }
  if (provider === 'anthropic') {
    return writeDraftWithAnthropic({ topic, format, context, temperature, previousDraft, regenerate, directorNote })
  }
  if (provider === 'groq') {
    return writeDraftWithGroq({ topic, format, context, temperature, previousDraft, regenerate, directorNote })
  }
  throw new Error(`unknown provider ${provider}`)
}

async function hotTakeRefineWithProvider({
  provider,
  topic,
  format,
  draft,
  temperature = 0.32,
  deskBrief = '',
}) {
  const { system, user } = buildHotTakeRefinePrompt({ topic, format, draft, deskBrief })
  if (provider === 'xai') {
    return cleanDraftText(await xaiTextCompletion({ system, user, temperature }))
  }
  if (provider === 'openai') {
    const key = envKey('OPENAI_API_KEY')
    const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
    return cleanDraftText(
      await chatTextCompletion({
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        timeoutMs: 45000,
      }),
    )
  }
  if (provider === 'anthropic') {
    return cleanDraftText(await anthropicTextCompletion({ system, user, temperature }))
  }
  if (provider === 'groq') {
    return cleanDraftText(await groqChatText({ system, user, temperature, timeoutMs: 45000 }))
  }
  throw new Error(`unknown provider ${provider}`)
}

async function polishDraftWithProvider({
  provider,
  topic,
  format,
  draft,
  temperature = 0.3,
  deskBrief = '',
}) {
  const { system, user } = buildPolishPrompt({ topic, format, draft, deskBrief })
  if (provider === 'xai') {
    return cleanDraftText(await xaiTextCompletion({ system, user, temperature }))
  }
  if (provider === 'openai') {
    const key = envKey('OPENAI_API_KEY')
    const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
    return cleanDraftText(
      await chatTextCompletion({
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        timeoutMs: 45000,
      }),
    )
  }
  if (provider === 'anthropic') {
    return cleanDraftText(await anthropicTextCompletion({ system, user, temperature }))
  }
  if (provider === 'groq') {
    return cleanDraftText(await groqChatText({ system, user, temperature, timeoutMs: 40000 }))
  }
  return draft
}

function buildAdaptPrompt({ draft, topic, format }) {
  const system = `You adapt an APPROVED Eyes Of Football narration into YouTube Short scenes.

HARD SCOPE:
${EOF_FOOTBALL_SCOPE}

Hard rules:
- 3–5 scenes only. Prefer 3–4 for short hot takes. Never pad to 7. Never more than ${EOF_MAX_SCENES}.
- If the draft names TWO people (e.g. Rooney + Tuchel), give the secondary person at least ONE scene imageQuery.
- Each caption is ON-SCREEN TEXT and spoken as voiceover. Max 12 words. Punchy. Mobile-first. No hashtags in captions.
- Always say football — never soccer.
- PRESERVE the draft's facts, teams, and meaning — compress, do not replace with generic filler.
- Hook (scene 1) from the draft's lead. CTA (last scene) from the draft's question.
- Each scene needs imageQuery: short English photo search that matches THAT caption's beat. Always name the lead player/coach/club from the topic first (e.g. Thomas Tuchel, Wayne Rooney). Then add the scene action: tactics/formation → "tactics board" or "sideline"; England debate → "England manager"; quote/press → "press conference"; goal → "celebrating". Prefer clear face-forward match photos. Always say football, never soccer. Never generic "stadium crowd" alone. Never switch the subject to a secondary name mentioned later in the draft.
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

async function chatTextCompletion({ url, headers, body, timeoutMs = 55000 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`${res.status}: ${errText.slice(0, 240)}`)
    }
    const data = await res.json()
    const msg = data?.choices?.[0]?.message
    const content =
      msg?.content ||
      msg?.reasoning ||
      (Array.isArray(msg?.content) ? msg.content.map((c) => c?.text || c).join('\n') : '')
    if (!String(content || '').trim()) throw new Error('empty draft content')
    return String(content).trim()
  } finally {
    clearTimeout(timer)
  }
}

async function chatJsonCompletion({ url, headers, body, timeoutMs = 55000 }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
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
  } finally {
    clearTimeout(timer)
  }
}

function parseJsonContent(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

function finalizeScript(parsed, topic, format, source, plainTextDraft) {
  const unwrapped = unwrapAdaptJson(parsed)
  const normalized = normalizeEofScript(
    { ...unwrapped, format, plainTextDraft: plainTextDraft || unwrapped?.plainTextDraft },
    topic,
  )
  if (!normalized || normalized.scenes.length < 3) {
    throw new Error('script had too few scenes')
  }
  normalized.scenes = normalized.scenes.slice(0, EOF_MAX_SCENES)
  if (plainTextDraft) normalized.plainTextDraft = plainTextDraft
  return { script: normalized, source }
}

function titleFromDraft(topic, draft) {
  const first = String(draft || '')
    .split(/[.!?]/)
    .map((s) => s.trim())
    .find(Boolean)
  if (first && first.length >= 12 && first.length <= 90) return first
  return String(topic || '').trim().slice(0, 90)
}

async function writeDraftWithXai({
  topic,
  format,
  context,
  temperature = 0.45,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
}) {
  const { system, user } = buildDraftPrompt({
    topic,
    format,
    context,
    previousDraft,
    regenerate,
    directorNote,
  })
  const text = cleanDraftText(await xaiTextCompletion({ system, user, temperature }))
  if (text.length < 40) throw new Error('draft too short')
  return { plainTextDraft: text, title: titleFromDraft(topic, text), source: 'xai' }
}

async function writeDraftWithOpenAi({
  topic,
  format,
  context,
  temperature = 0.45,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
}) {
  const key = envKey('OPENAI_API_KEY')
  const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
  const { system, user } = buildDraftPrompt({
    topic,
    format,
    context,
    previousDraft,
    regenerate,
    directorNote,
  })
  const text = cleanDraftText(
    await chatTextCompletion({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${key}` },
      body: {
        model,
        temperature,
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

async function writeDraftWithAnthropic({
  topic,
  format,
  context,
  temperature = 0.45,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
}) {
  const { system, user } = buildDraftPrompt({
    topic,
    format,
    context,
    previousDraft,
    regenerate,
    directorNote,
  })
  const text = cleanDraftText(await anthropicTextCompletion({ system, user, temperature }))
  if (text.length < 40) throw new Error('draft too short')
  return { plainTextDraft: text, title: titleFromDraft(topic, text), source: 'anthropic' }
}

async function writeDraftWithGroq({
  topic,
  format,
  context,
  temperature = 0.45,
  previousDraft = '',
  regenerate = false,
  directorNote = '',
}) {
  const note = String(directorNote || '').trim()
  const prev = String(previousDraft || '').trim()
  const { system, user } = buildDraftPrompt({
    topic,
    format,
    context,
    previousDraft: prev,
    regenerate,
    directorNote: note,
  })

  let text = cleanDraftText(
    await groqChatText({
      system,
      user,
      temperature: note ? Math.min(0.75, temperature + 0.12) : temperature,
      timeoutMs: 50000,
    }),
  )

  // Reject meta chat / stubs and retry with an ultra-lean directed prompt
  if (wordCount(text) < 40 || isMetaDraftReply(text)) {
    console.warn('[eof-script] groq draft weak, retrying', wordCount(text), text.slice(0, 80))
    const leanUser = note
      ? `Producer direction: ${note}

Topic: ${topic}
${prev ? `Draft to rewrite:\n${prev.slice(0, 500)}\n` : ''}
Write a FULL 90–130 word football Shorts voiceover now. Plain prose only.`
      : `${user}

CRITICAL: Write a FULL spoken Shorts voiceover of 90–130 words. Plain prose only. No JSON. No preamble.`
    text = cleanDraftText(
      await groqChatText({
        system,
        user: leanUser,
        temperature: Math.min(0.8, temperature + 0.2),
        timeoutMs: 50000,
      }),
    )
  }

  if (wordCount(text) < 40 || isMetaDraftReply(text)) {
    throw new Error(`draft too short (${wordCount(text)} words)`)
  }
  return { plainTextDraft: text, title: titleFromDraft(topic, text), source: 'groq' }
}

/** Detect Groq chatty refusals / plans instead of an actual VO. */
function isMetaDraftReply(text) {
  const t = String(text || '').trim()
  if (!t) return true
  if (wordCount(t) >= 55) return false
  return /^(sure|okay|ok|here'?s|i('ll| will)|let me|of course|absolutely)\b/i.test(t) ||
    /\b(i will rewrite|here's (a |my )?plan|as an ai|i cannot|i can't write)\b/i.test(t)
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

async function adaptWithAnthropic({ draft, topic, format }) {
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  const parsed = await anthropicJsonCompletion({ system, user, temperature: 0.35 })
  return finalizeScript(parsed, topic, format, 'anthropic', draft)
}

async function adaptWithGroq({ draft, topic, format }) {
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  try {
    const parsed = await groqChatJson({ system, user, temperature: 0.4, timeoutMs: 50000 })
    return finalizeScript(parsed, topic, format, 'groq', draft)
  } catch (firstErr) {
    console.warn(
      '[eof-script] groq json adapt failed, trying text fallback',
      firstErr instanceof Error ? firstErr.message : firstErr,
    )
    const text = await groqChatText({
      system: `${system}\nReturn ONLY one valid JSON object. No markdown fences or commentary.`,
      user,
      temperature: 0.35,
      timeoutMs: 50000,
    })
    const parsed = parseJsonContent(cleanDraftText(text))
    return finalizeScript(parsed, topic, format, 'groq', draft)
  }
}
