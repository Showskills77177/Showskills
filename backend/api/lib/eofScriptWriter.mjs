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
  }
}

const SCRIPT_PROVIDER_IDS = new Set(['auto', 'groq', 'xai', 'openai'])

/** UI + API: script AI options (Groq is the free tier). */
export function listEofScriptProviderOptions() {
  const status = eofScriptProviderStatus()
  return [
    {
      id: 'auto',
      label: 'Auto',
      configured: true,
      detail: 'Groq (free) first when set, then OpenAI. xAI only if no Groq/OpenAI (needs credits).',
    },
    {
      id: 'groq',
      label: 'Groq — Llama 3.3 70B (free)',
      configured: status.groq,
      detail: 'Free at console.groq.com — set GROQ_API_KEY on Vercel.',
    },
    {
      id: 'xai',
      label: 'xAI Grok 4.5',
      configured: status.xai,
      detail: 'Needs paid xAI team credits at console.x.ai.',
    },
    {
      id: 'openai',
      label: 'OpenAI',
      configured: status.openai,
      detail: 'Set OPENAI_API_KEY (optional OPENAI_MODEL=gpt-4.1).',
    },
  ]
}

function defaultAutoProviderOrder(status) {
  const order = []
  if (status.groq) order.push('groq')
  if (status.openai) order.push('openai')
  // Skip xAI in Auto when a free/paid writer is already available — xAI without
  // credits only wastes time and used to be mis-labelled as a Groq key error.
  if (status.xai && !status.groq && !status.openai) order.push('xai')
  return order
}

/** Ordered provider ids to try for draft/adapt (respects UI pick + EOF_SCRIPT_PROVIDER env). */
export function resolveScriptProviderAttemptOrder(scriptProvider) {
  const status = eofScriptProviderStatus()
  const configured = defaultAutoProviderOrder(status)
  const envPick = envKey('EOF_SCRIPT_PROVIDER', 'EOF_DEFAULT_SCRIPT_PROVIDER').toLowerCase()
  const pick = String(scriptProvider || envPick || 'auto').toLowerCase()

  if (pick === 'auto' || !SCRIPT_PROVIDER_IDS.has(pick)) return configured

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
  if (source && source !== 'template') return null

  const detail =
    typeof jobOrSource === 'object' && jobOrSource
      ? String(jobOrSource.scriptFailureDetail || jobOrSource.failureDetail || '').trim()
      : ''

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
      return 'Groq timed out on the multi-pass write. Click Regenerate script once more (usually works on retry).'
    }
    if (/weak|fluff|rejected/i.test(detail)) {
      return 'Script AI fell back to a template. Pick Groq, then click Regenerate script — each pass writes a fresh draft (higher creativity).'
    }
    if (detail) {
      return `Script AI failed (${detail.slice(0, 160)}). Using a built-in fallback — pick Groq and Regenerate.`
    }
    return 'Script AI did not return a usable draft. Pick Groq in Script AI and Regenerate (or check GROQ_API_KEY).'
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
  const words = t.split(/\s+/).filter(Boolean).length
  return words >= 40
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

async function groqChatText({ system, user, temperature = 0.4, timeoutMs = 45000 }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  if (!key) throw new Error('GROQ_API_KEY is not set')
  let lastErr
  for (const model of groqModelCandidates()) {
    try {
      return await chatTextCompletion({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model,
          temperature,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        },
        timeoutMs,
      })
    } catch (e) {
      lastErr = e
      console.warn('[eof-script] groq text model failed', model, e instanceof Error ? e.message : e)
      if (isRetryableGroqModelError(e)) continue
      throw e
    }
  }
  throw lastErr || new Error('Groq text completion failed')
}

async function groqChatJson({ system, user, temperature = 0.25, timeoutMs = 45000 }) {
  const key = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  if (!key) throw new Error('GROQ_API_KEY is not set')
  let lastErr
  for (const model of groqModelCandidates()) {
    try {
      return await chatJsonCompletion({
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model,
          temperature,
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
      console.warn('[eof-script] groq json model failed', model, e instanceof Error ? e.message : e)
      if (isRetryableGroqModelError(e)) continue
      throw e
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
} = {}) {
  const rawTopic = String(topic || '').trim()
  if (rawTopic.length < 2) throw new Error('Topic is required (min 2 characters).')
  const fmt = resolveFormat(format)
  const prev = String(previousDraft || '').trim()
  // Regenerate: hotter than first pass, but not chaos — high temp caused invented scores
  const draftTemperature = regenerate ? 0.72 : 0.42
  const polishTemperature = regenerate ? 0.25 : 0.28
  const forceAcceptAi = Boolean(regenerate)

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
  const attempts = []
  for (const id of order) {
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
            regenerate,
          }),
      })
    }
  }

  const failures = []
  let softBest = null
  for (const { id, run } of attempts) {
    try {
      const raw = await withBudget(run(), 90000, `${id} draft pipeline`)
      const ai = finalizeAiDraft(raw, t, resolvedTopic)
      if (!ai) {
        failures.push(`[${id}] empty/too-short draft`)
        console.warn('[eof-script] draft empty/short', id, raw?.plainTextDraft?.slice?.(0, 80))
        continue
      }
      if (prev && draftSimilarity(prev, ai.plainTextDraft) >= 0.72) {
        failures.push(`[${id}] too similar to previous draft`)
        console.warn('[eof-script] draft too similar to previous', id)
        softBest = softBest || { ...ai, deskSources }
        continue
      }
      if (isWeakDraft(ai.plainTextDraft)) {
        softBest = { ...ai, deskSources }
        failures.push(`[${id}] soft-weak draft kept as candidate`)
        console.warn('[eof-script] draft soft-weak, keeping as candidate', id, ai.plainTextDraft.slice(0, 80))
        // On regenerate, still try next provider if any — don't force-accept fluff/NFL
        if (!forceAcceptAi) continue
        continue
      }
      return { ...ai, deskSources }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`[${id}] ${msg}`)
      console.warn('[eof-script] draft provider failed', id, msg)
    }
  }

  if (softBest) {
    return { ...softBest, deskSources: softBest.deskSources || deskSources }
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

function buildDraftPrompt({ topic, format, context, previousDraft = '', regenerate = false }) {
  const angles = [
    'lead with the result and what it means next',
    'lead with the quote or claim, then the pushback',
    'lead with the tactical / selection angle',
    'lead with the fan / dressing-room reaction',
    'lead with the timeline — what just changed today',
  ]
  const angle = angles[Math.floor(Date.now() / 1000) % angles.length]

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
- FACT LOCK: Use ONLY names, scores, clubs, and claims present in the DESK BRIEF. If the brief is thin, stay general — do NOT invent match scores, transfer fees, or fake quotes.
- Structure for format "${format}": ${draftFormatGuide(format)}
- End with ONE sharp question for comments (Comment / Drop your take).

BANNED forever:
"here's what we know so far", "the key detail fans need", "why it matters for the club", "just another chapter", "global superstar energy", "raw talent", "unforgettable nights", "most fans still miss", "it is important to note", "throughout his career", "in conclusion", "as we all know", "a testament to", "indelible mark", "woven into the fabric", "cannot be overstated", "in today's footballing landscape", literary metaphors, long subordinate clauses.`

  const regenBlock =
    regenerate && previousDraft
      ? `\nREGENERATE — angle: ${angle}.
Write a DIFFERENT voiceover: new opening line, new structure, new CTA question.
Keep the same verified facts from the DESK BRIEF. Do not paraphrase the previous draft sentence-by-sentence.
PREVIOUS DRAFT (avoid copying):\n"""\n${previousDraft.slice(0, 900)}\n"""\n`
      : regenerate
        ? `\nREGENERATE — angle: ${angle}. New opening line required. Stay inside the DESK BRIEF facts.\n`
        : ''

  const user = `Topic / headline: ${topic}
${context ? `\nDESK BRIEF (SOURCE OF TRUTH — do not invent beyond these notes):\n${context}\n` : '\nDESK BRIEF: (none returned — do not invent scores or quotes; keep it cautious.)\n'}${regenBlock}
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
}) {
  let workingTopic = topic
  let researchCtx = context
  // Groq free tier: skip extra research call when we already have Guardian/RSS desk notes
  const skipResearch = provider === 'groq' && String(headlinesText || '').trim().length >= 80
  if (!skipResearch) {
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
  } else if (headlinesText) {
    researchCtx = [context, 'DESK BRIEF / HEADLINES (SOURCE OF TRUTH):\n' + headlinesText]
      .filter(Boolean)
      .join('\n\n')
  }

  const draftResult = await writeDraftWithProvider({
    provider,
    topic: workingTopic,
    format,
    context: researchCtx,
    temperature,
    previousDraft,
    regenerate,
  })
  let text = draftResult.plainTextDraft
  // On regenerate, polish only lightly (already low temp) — skip if polish collapses uniqueness
  try {
    const polished = await polishDraftWithProvider({
      provider,
      topic: workingTopic,
      format,
      draft: text,
      temperature: polishTemperature,
    })
    if (polished && polished.length >= 80) {
      if (regenerate && previousDraft && draftSimilarity(previousDraft, polished) >= 0.78) {
        // keep pre-polish draft — polish drifted back toward the old script
      } else {
        text = polished
      }
    }
  } catch (e) {
    console.warn('[eof-script] polish pass skipped', provider, e instanceof Error ? e.message : e)
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
}) {
  if (provider === 'xai') {
    return writeDraftWithXai({ topic, format, context, temperature, previousDraft, regenerate })
  }
  if (provider === 'openai') {
    return writeDraftWithOpenAi({ topic, format, context, temperature, previousDraft, regenerate })
  }
  if (provider === 'groq') {
    return writeDraftWithGroq({ topic, format, context, temperature, previousDraft, regenerate })
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
    const content = data?.choices?.[0]?.message?.content
    if (!content?.trim()) throw new Error('empty draft content')
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

async function writeDraftWithXai({ topic, format, context, temperature = 0.45, previousDraft = '', regenerate = false }) {
  const { system, user } = buildDraftPrompt({ topic, format, context, previousDraft, regenerate })
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
}) {
  const key = envKey('OPENAI_API_KEY')
  const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
  const { system, user } = buildDraftPrompt({ topic, format, context, previousDraft, regenerate })
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
}) {
  const { system, user } = buildDraftPrompt({ topic, format, context, previousDraft, regenerate })
  const text = cleanDraftText(await groqChatText({ system, user, temperature, timeoutMs: 45000 }))
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
  const { system, user } = buildAdaptPrompt({ draft, topic, format })
  const parsed = await groqChatJson({ system, user, temperature: 0.4, timeoutMs: 50000 })
  return finalizeScript(parsed, topic, format, 'groq', draft)
}
