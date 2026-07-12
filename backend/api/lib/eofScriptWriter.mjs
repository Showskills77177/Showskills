/**
 * Script writer for EOF image Shorts — multi-pass flow:
 *   0) Desk research (RSS headlines + editor brief)
 *   1) Shorts voiceover draft (spoken, not a book chapter)
 *   2) Polish pass (cut fluff, tighten hook/CTA)
 *   3) Adapt draft → Short scenes (captions + image queries)
 *
 * Auto provider order when configured: Groq (free) → OpenAI → xAI Grok.
 * UI can force a provider via scriptProvider (groq | xai | openai | auto).
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
import {
  fetchFootballDeskHeadlines,
  formatDeskHeadlinesForPrompt,
  buildDeskResearchSystemPrompt,
  buildDeskResearchUserPrompt,
  deskBriefToContext,
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
    newsdata: isNewsdataConfigured(),
    guardian: isGuardianConfigured(),
    perplexity: shouldUsePerplexity(),
    judge: eofScriptJudgeStatus(),
  }
}

const SCRIPT_PROVIDER_IDS = new Set(['auto', 'groq', 'xai', 'openai'])

/** UI + API: script AI options (Groq is the free tier). */
export function listEofScriptProviderOptions() {
  const status = eofScriptProviderStatus()
  return [
    {
      id: 'auto',
      label: 'Auto (best quality)',
      configured: true,
      detail:
        'Tunes temps by format, judges merit/interest/value, then escalates Groq → OpenAI/xAI until the best script wins.',
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
      detail: 'Writer or judge — set OPENAI_API_KEY (best second-model judge for Groq drafts).',
    },
  ]
}

function defaultAutoProviderOrder(status) {
  // Fast free draft first; paid models used as Auto escalation for best quality.
  const order = []
  if (status.groq) order.push('groq')
  if (status.openai) order.push('openai')
  if (status.xai) order.push('xai')
  return order
}

export function isAutoScriptMode(scriptProvider) {
  const envPick = envKey('EOF_SCRIPT_PROVIDER', 'EOF_DEFAULT_SCRIPT_PROVIDER').toLowerCase()
  const pick = String(scriptProvider || envPick || 'auto').toLowerCase()
  return pick === 'auto' || !SCRIPT_PROVIDER_IDS.has(pick)
}

/** Format-aware temps + excellence bar for Auto quality mode. */
export function autoTuneDraftSettings({ format, regenerate = false, directorNote = '' } = {}) {
  const fmt = resolveFormat(format)
  const directed = Boolean(String(directorNote || '').trim())
  let draftTemperature = 0.42
  let polishTemperature = 0.28
  // News/quotes: cooler = fewer invented facts. Debate/hooks: warmer punch.
  if (fmt === 'news' || fmt === 'quote') {
    draftTemperature = 0.36
    polishTemperature = 0.22
  } else if (fmt === 'debate' || fmt === 'hook_reveal') {
    draftTemperature = 0.55
    polishTemperature = 0.3
  } else if (fmt === 'listicle' || fmt === 'timeline') {
    draftTemperature = 0.46
    polishTemperature = 0.26
  }
  if (regenerate || directed) {
    draftTemperature = Math.min(0.78, draftTemperature + 0.2)
    polishTemperature = 0.24
  }
  const excellentMin = Number(envKey('EOF_SCRIPT_AUTO_EXCELLENT') || 7.5)
  return {
    draftTemperature,
    polishTemperature,
    excellentMin: Number.isFinite(excellentMin) ? Math.min(9.5, Math.max(6, excellentMin)) : 7.5,
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
  const envPick = envKey('EOF_SCRIPT_PROVIDER', 'EOF_DEFAULT_SCRIPT_PROVIDER').toLowerCase()
  const pick = String(scriptProvider || envPick || 'auto').toLowerCase()

  if (pick === 'auto' || !SCRIPT_PROVIDER_IDS.has(pick)) {
    // Auto draft attempt: Groq first for speed; openai/xai kept for escalation in write loop
    return configured.filter((id, i, arr) => arr.indexOf(id) === i)
  }

  if (!status[pick]) return configured
  return [pick, ...configured.filter((id) => id !== pick)]
}

/** Primary LLM provider for new scripts. */
export function preferredEofScriptProvider() {
  const order = resolveScriptProviderAttemptOrder('auto')
  return order[0] || 'template'
}

export function eofScriptProviderLabel(provider) {
  if (provider === 'xai') return 'xAI Grok 4.5'
  if (provider === 'openai') return 'OpenAI'
  if (provider === 'groq') {
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
  return s.xai || s.openai || s.groq
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
      'QUOTE SHORT: Open with the speaker + the quote (or a tight paraphrase). Then where it was said (BBC studio / Sky / presser / newspaper). Then who it hits and why fans argue. End with agree/disagree CTA. Do not write an essay — punchy spoken VO.',
    listicle:
      'Structure: hook → 3 punchy football beats → CTA. Each beat = one concrete club/nation/era fact. No essay padding.',
    hook_reveal:
      'Structure: bold claim → one origin beat → turning point → payoff → CTA. Tension, then pay it off. Spoken, not literary.',
    debate:
      'Structure: hot take → critic case (1 beat) → fan case (1 beat) → verdict → pick-a-side CTA. Fair but punchy.',
    timeline:
      'Structure: start → breakthrough → peak → legacy → CTA. One era per beat. Real clubs/nations only.',
    news:
      'Structure: BREAKING lead (who/what) → what happened → why it matters now → what happens next → CTA. Desk TV copy, not longform journalism.',
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
  if (format === 'quote' || /["“].+["”]|:\s*"/.test(clean)) {
    return `${clean} — and that line is already splitting football fans. It was said in public, not in a group chat, so the stakes are real: reputation, selection, and who gets the blame. Strip the noise and you still have a clear football argument. Agree or disagree with that quote? Comment.`
  }
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
  if (!providers.openai && !providers.groq) {
    return 'No working AI script provider. Set free GROQ_API_KEY at console.groq.com → Vercel env → Redeploy.'
  }
  return 'AI script providers failed — using a built-in fallback draft. Check API keys and billing.'
}

/** Infer which provider owned the last failure (from tagged or raw error text). */
function classifyScriptFailureProvider(detail) {
  const d = String(detail || '')
  if (!d) return null
  // Prefer explicit [provider] tags from the draft loop
  const tagged = /\[(groq|openai|xai)\]/gi.exec(d)
  if (tagged) return tagged[1].toLowerCase()
  if (/xai|grok-|\bGrok\b|console\.x\.ai|team doesn't have any credits/i.test(d)) return 'xai'
  if (/groq|api\.groq|llama-3|gpt-oss-20b/i.test(d)) return 'groq'
  if (/openai|api\.openai|gpt-4/i.test(d)) return 'openai'
  return null
}

const DRAFT_FLUFF_RE =
  /here'?s what we know so far|the result or move that matters|why clubs and fans care|just another chapter|global superstar energy|rewrote elite|unforgettable nights|raw talent|most fans still miss|it is important to note|throughout (his|her|their|the) (career|history)|in conclusion|as we all know|the beautiful game of|a testament to|indelible mark|woven into the fabric|cannot be overstated|in today'?s footballing landscape/i

/** Prefer punchy Shorts VO — only reject obvious fluff / tiny stubs. */
function isWeakDraft(text) {
  const t = String(text || '').trim()
  const words = t.split(/\s+/).filter(Boolean).length
  if (words < 45) return true
  if (words > 280) return true
  if (DRAFT_FLUFF_RE.test(t)) return true
  if (/\bsoccer\b/i.test(t)) return true
  if (/\b(NFL|NBA|MLB|NHL)\b/.test(t)) return true
  return false
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
} = {}) {
  const rawTopic = String(topic || '').trim()
  if (rawTopic.length < 2) throw new Error('Topic is required (min 2 characters).')
  const fmt = resolveFormat(format)
  const prev = String(previousDraft || '').trim()
  const note = String(directorNote || '').trim().slice(0, 1200)
  const autoMode = isAutoScriptMode(scriptProvider)
  const tuned = autoTuneDraftSettings({ format: fmt, regenerate, directorNote: note })
  const draftTemperature = tuned.draftTemperature
  const polishTemperature = tuned.polishTemperature
  const excellentMin = tuned.excellentMin
  if (autoMode) {
    console.info(
      '[eof-script] auto tune',
      fmt,
      'temp',
      draftTemperature,
      'excellent≥',
      excellentMin,
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
  let headlinesText = ''
  try {
    const pack = await withBudget(fetchFreeFootballDeskPack({ topic: t, limit: 8 }), 15000, 'free desk pack')
    headlinesText = pack.text || ''
    deskSources = pack.sources || null
    if (headlinesText) {
      console.info('[eof-script] free desk pack', pack.sources)
    } else if (pack.sources?.newsdataConfigured && pack.sources.newsdata === 0) {
      console.warn('[eof-script] NewsData keyed but returned 0 articles for', t.slice(0, 60))
    }
  } catch (e) {
    console.warn('[eof-script] free desk pack skipped', e instanceof Error ? e.message : e)
    try {
      const headlines = await withBudget(fetchFootballDeskHeadlines({ topic: t, limit: 8 }), 12000, 'desk RSS')
      headlinesText = formatDeskHeadlinesForPrompt(headlines)
      deskSources = { newsdata: 0, guardian: 0, rss: headlines?.length || 0, newsdataConfigured: isNewsdataConfigured(), guardianConfigured: isGuardianConfigured() }
    } catch (e2) {
      console.warn('[eof-script] desk RSS skipped', e2 instanceof Error ? e2.message : e2)
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
    if (id === 'xai' || id === 'openai' || id === 'groq') {
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
          topic: t,
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
      judge = { skipped: true, pass: true, reasons: ['Judge error — accepted draft'] }
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
            ? 'Auto quality pass: sharper hook, denser football facts, stronger CTA. Stay inside the desk brief.'
            : '',
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
      // Producer chat direction: accept the usable rewrite immediately (no judge / similarity gates)
      if (note && wordCount(ai.plainTextDraft) >= 35) {
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
      if (isWeakDraft(ai.plainTextDraft)) {
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
          if (rewrittenAi && !isWeakDraft(rewrittenAi.plainTextDraft)) {
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
          if (nextId === 'xai' || nextId === 'openai' || nextId === 'groq') {
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
                    'Stronger first-line hook with names + event',
                    'More concrete desk-brief facts',
                    'Sharper CTA question',
                  ],
                  merit: 5,
                  interest: 5,
                  value: 5,
                  overall: 5,
                  threshold: excellentMin,
                },
                0.08,
              )
              if (!escalated || isWeakDraft(escalated.plainTextDraft)) continue
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

      if (candidate && (judge?.pass || judge?.skipped || !judge)) {
        // Accept best pass even if not "excellent" after escalation
        if (judge?.pass || judge?.skipped || !judge) return softBest || candidate
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
          }),
          90000,
          `${id} auto-fallback draft`,
        )
        const ai = finalizeAiDraft(raw, t, resolvedTopic)
        if (!ai || isWeakDraft(ai.plainTextDraft)) continue
        const { candidate, judge } = await scoreAndMaybeKeep(ai, id)
        if (isExcellentJudge(judge, excellentMin) || judge?.pass || judge?.skipped) return candidate
      } catch (e) {
        failures.push(`[${id}] ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  if (softBest) {
    return { ...softBest, deskSources: softBest.deskSources || deskSources }
  }

  // Directed rewrite failed: keep the previous draft instead of wiping it with a canned template
  if (prev && wordCount(prev) >= 40) {
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

  return {
    plainTextDraft: templatePlainTextDraft(t, fmt),
    title: t.slice(0, 90),
    source: 'template',
    resolvedTopic,
    deskSources,
    failureDetail: failures.length ? failures.join(' · ') : 'no AI provider returned a usable draft',
  }
}

/**
 * Step 2 — split approved plain text into Short scenes.
 * @param {{ plainTextDraft: string, topic: string, format?: string }} input
 */
export async function adaptEofPlainTextToScenes({ plainTextDraft, topic, format, scriptProvider }) {
  const draft = String(plainTextDraft || '').trim()
  if (draft.length < 40) throw new Error('Plain-text draft is too short — write or generate a fuller script first.')
  const t = String(topic || '').trim() || 'Football'
  const fmt = resolveFormat(format)

  const order = resolveScriptProviderAttemptOrder(scriptProvider)
  const attempts = []
  for (const id of order) {
    if (id === 'xai') attempts.push(() => adaptWithXai({ draft, topic: t, format: fmt }))
    if (id === 'openai') attempts.push(() => adaptWithOpenAi({ draft, topic: t, format: fmt }))
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
export async function writeEofProductionScript({ topic, format, context, scriptProvider }) {
  const draftResult = await writeEofPlainTextDraft({ topic, format, context, scriptProvider })
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

function buildDraftPrompt({ topic, format, context, previousDraft = '', regenerate = false, directorNote = '' }) {
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
  const desk = String(context || '').trim().slice(0, 1600)

  const system = `You write YouTube SHORTS voiceovers for Eyes Of Football — NOT articles, NOT book chapters, NOT essays.

HARD SCOPE:
${EOF_FOOTBALL_SCOPE}

OUTPUT = ONE continuous spoken script. Plain prose only. No JSON, bullets, scene labels, hashtags, or titles.

SHORTS VOICE (non-negotiable):
- 90–130 words. Spoken in ~35–45 seconds. If you write more, cut it.
- Short sentences. Average under 16 words. Max one clause per beat.
- Sound like Sky Sports News / BBC Sport desk at 10pm: punchy, opinionated, common-sense.
- Always say football — never soccer. Never NFL / NBA / American sports.
- FIRST SENTENCE must name the player/club/nation AND the event.
- FACT LOCK: Use ONLY names, scores, clubs, and claims present in the DESK BRIEF / current draft. If thin, stay general — do NOT invent match scores, transfer fees, or fake quotes.
- If PRODUCER DIRECTION is provided, follow it closely (tone, angle, names to stress, what to open with) while keeping Shorts length and fact lock.
- Structure for format "${format}": ${draftFormatGuide(format)}
- End with ONE sharp question for comments (Comment / Drop your take).

BANNED forever:
"here's what we know so far", "the key detail fans need", "why it matters for the club", "just another chapter", "global superstar energy", "raw talent", "unforgettable nights", "most fans still miss", "it is important to note", "throughout his career", "in conclusion", "as we all know", "a testament to", "indelible mark", "woven into the fabric", "cannot be overstated", "in today's footballing landscape", literary metaphors, long subordinate clauses.
Never reply with meta chat ("Sure", "I'll rewrite", "Here is a plan"). Output the voiceover only.`

  // Directed rewrite: keep the prompt lean so Groq free tier actually returns a full VO
  if (note) {
    const user = `Topic / headline: ${topic}

PRODUCER DIRECTION (must follow — this is how they want the script written):
"""
${note}
"""
${prev ? `\nCURRENT DRAFT (rewrite this — do not copy sentence-by-sentence):\n"""\n${prev.slice(0, 700)}\n"""\n` : ''}
${desk ? `\nDESK FACTS (do not invent beyond):\n${desk}\n` : ''}
Write the FULL spoken Shorts voiceover now (90–130 words). Plain prose only. No preamble.`
    return { system, user }
  }

  const regenBlock =
    regenerate && prev
      ? `\nREGENERATE — angle: ${angle}.
Write a DIFFERENT voiceover: new opening line, new structure, new CTA question.
Keep the same verified facts from the DESK BRIEF. Do not paraphrase the previous draft sentence-by-sentence.
PREVIOUS DRAFT (avoid copying):\n"""\n${prev.slice(0, 700)}\n"""\n`
      : regenerate
        ? `\nREGENERATE — angle: ${angle}. New opening line required. Stay inside the DESK BRIEF facts.\n`
        : ''

  const user = `Topic / headline: ${topic}
${desk ? `\nDESK BRIEF (SOURCE OF TRUTH — do not invent beyond these notes):\n${desk}\n` : '\nDESK BRIEF: (none returned — do not invent scores or quotes; keep it cautious.)\n'}${regenBlock}
Write the spoken Shorts voiceover only. No preamble.`

  return { system, user }
}

function buildPolishPrompt({ topic, format, draft }) {
  const system = `You are a ruthless YouTube Shorts editor for Eyes Of Football.

Rewrite the draft into a TIGHTER spoken voiceover. Keep EVERY name, score, club, and claim — do not invent new facts.

Rules:
- 90–130 words. Cut every soft phrase.
- First line must hook with names + event.
- Short spoken sentences. No book language.
- Always football, never soccer. Never NFL.
- Keep one CTA question at the end.
- Format intent: ${format}. ${draftFormatGuide(format)}
- Output plain prose only.`

  const user = `Topic: ${topic}

Draft to tighten:
"""
${draft}
"""

Return only the improved voiceover.`

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
}) {
  let workingTopic = topic
  let researchCtx = context
  const isGroq = provider === 'groq'
  // Groq: never spend a JSON research call — use free desk pack / context only
  if (isGroq) {
    researchCtx = [context, headlinesText ? `DESK BRIEF / HEADLINES (SOURCE OF TRUTH):\n${headlinesText}` : '']
      .filter(Boolean)
      .join('\n\n')
  } else {
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
          researchCtx = [context, built].filter(Boolean).join('\n\n')
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
  const allowPolish =
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

  return {
    plainTextDraft: text,
    title: titleFromDraft(workingTopic, text),
    source: provider,
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
  if (provider === 'groq') {
    return writeDraftWithGroq({ topic, format, context, temperature, previousDraft, regenerate, directorNote })
  }
  throw new Error(`unknown provider ${provider}`)
}

async function polishDraftWithProvider({ provider, topic, format, draft, temperature = 0.3 }) {
  const { system, user } = buildPolishPrompt({ topic, format, draft })
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
- Exactly 5 scenes (4–6 only if the draft truly needs it; never more than ${EOF_MAX_SCENES}).
- Each caption is ON-SCREEN TEXT and spoken as voiceover. Max 12 words. Punchy. Mobile-first. No hashtags in captions.
- Always say football — never soccer.
- PRESERVE the draft's facts, teams, and meaning — compress, do not replace with generic filler.
- Hook (scene 1) from the draft's lead. CTA (last scene) from the draft's question.
- Each scene needs imageQuery: short English photo search naming the SAME player/club/nation as the caption (plus action like celebrating, presser, training). Prefer recent match photos. Always say football, never soccer. Never use generic queries like "stadium crowd" alone.
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

async function adaptWithGroq({ draft, topic, format }) {
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  const parsed = await groqChatJson({ system, user, temperature: 0.4, timeoutMs: 50000 })
  return finalizeScript(parsed, topic, format, 'groq', draft)
}
