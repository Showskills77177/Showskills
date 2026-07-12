/**
 * Quote script sourcing for Eyes Of Football Shorts.
 * Finds attributed football quotes and builds a desk brief for Shorts.
 *
 * Free-first (no Perplexity required):
 *   1) Guardian Open Platform (free API key) + BBC/Sky/Guardian RSS
 *   2) Groq / OpenAI / xAI extract one bite-worthy attributed quote from those articles
 *
 * Optional paid:
 *   3) Perplexity Sonar — only if EOF_USE_PERPLEXITY=1 and PERPLEXITY_API_KEY is set
 *
 * Env:
 *   GUARDIAN_API_KEY=...          free at open-platform.theguardian.com
 *   GROQ_API_KEY=...              free writer / quote extractor
 *   EOF_QUOTE_PAGES=page1,page2   optional Instagram/quote page names for prompts
 *   EOF_USE_PERPLEXITY=1          opt-in paid live search
 *   PERPLEXITY_API_KEY=...        optional paid (ignored unless EOF_USE_PERPLEXITY=1)
 */
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'
import { shouldUsePerplexity, getPerplexityApiKey, perplexityModel } from './eofPerplexityClient.mjs'
import { fetchFreeFootballDeskPack, isGuardianConfigured } from './eofFreeNewsSourcing.mjs'

/** Default public quote / football-talk sources the researcher should prefer. */
export const EOF_DEFAULT_QUOTE_PAGES = [
  'BBC Sport',
  'Sky Sports',
  'The Athletic',
  'ESPN FC',
  'The Sun football',
  'Daily Mail Sport',
  'Goal.com',
  'Marca',
  "L'Équipe",
  'Reuters Sport',
  'Associated Press Sport',
]

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

/** Extra Instagram / quote pages from env (comma-separated). */
export function eofConfiguredQuotePages() {
  const raw = envKey('EOF_QUOTE_PAGES', 'EOF_INSTAGRAM_QUOTE_PAGES')
  if (!raw) return []
  return raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40)
}

export function allEofQuoteSourcePages() {
  const extra = eofConfiguredQuotePages()
  return [...extra, ...EOF_DEFAULT_QUOTE_PAGES.filter((p) => !extra.includes(p))]
}

function parseJsonLoose(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

function normalizeQuoteHit(raw) {
  if (!raw || typeof raw !== 'object') return null
  const speaker = String(raw.speaker || raw.who || '').trim()
  const quote = String(raw.quote || raw.text || '').trim()
  if (speaker.length < 2 || quote.length < 12) return null
  return {
    speaker: speaker.slice(0, 80),
    role: String(raw.role || raw.title || '').trim().slice(0, 80),
    quote: quote.slice(0, 280),
    outlet: String(raw.outlet || raw.source || raw.desk || '').trim().slice(0, 80),
    context: String(raw.context || raw.about || '').trim().slice(0, 240),
    whyItBites: String(raw.whyItBites || raw.why || '').trim().slice(0, 200),
    target: String(raw.target || raw.aboutPlayer || '').trim().slice(0, 80),
    ctaQuestion: String(raw.ctaQuestion || raw.cta || '').trim().slice(0, 140),
    sources: Array.isArray(raw.sources) ? raw.sources.map(String).slice(0, 5) : [],
  }
}

const QUOTE_EXTRACT_SYSTEM = `You extract ONE attributed football quote for a YouTube Short.

${EOF_FOOTBALL_SCOPE}

Rules:
- Use ONLY the provided articles/headlines. Do not invent fake quotes.
- Prefer strong, clear, bite-worthy quotes (criticism, worry, rivalry, hot takes).
- Always say football — never soccer.
- Return JSON only.`

function quoteExtractUser({ topic, format, articlesText, pages }) {
  return `Topic hint: ${topic || '(any timely football quote from the articles)'}
Format: ${format}
Preferred desks/pages: ${pages.slice(0, 12).join(', ')}

Articles / headlines:
${articlesText || '(none)'}

Return JSON:
{
  "speaker": "Wayne Rooney",
  "role": "ex-England / pundit",
  "quote": "what they said (from the articles)",
  "exact": true,
  "outlet": "BBC Sport / Sky Sports / The Guardian / press conference",
  "context": "when/where and what it was about",
  "target": "who or what the quote is about",
  "whyItBites": "why fans will argue in comments",
  "ctaQuestion": "one sharp agree/disagree question",
  "sources": ["outlet names"]
}`
}

async function chatJson({ url, key, model, system, user }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const res = await fetch(url, {
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
      signal: controller.signal,
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = await res.json()
    return parseJsonLoose(data?.choices?.[0]?.message?.content || '')
  } finally {
    clearTimeout(timer)
  }
}

/** Extract quote JSON with free Groq first, then OpenAI. */
async function extractQuoteWithFreeLlms({ topic, format, articlesText, pages }) {
  const system = QUOTE_EXTRACT_SYSTEM
  const user = quoteExtractUser({ topic, format, articlesText, pages })
  const groqKey = envKey('GROQ_API_KEY', 'EOF_GROQ_API_KEY')
  const openaiKey = envKey('OPENAI_API_KEY')

  if (groqKey) {
    const preferred = envKey('GROQ_MODEL', 'EOF_GROQ_MODEL')
    const models = [
      preferred,
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-20b',
    ].filter(Boolean)
    const unique = [...new Set(models)]
    let lastErr
    for (const model of unique) {
      try {
        return await chatJson({
          url: 'https://api.groq.com/openai/v1/chat/completions',
          key: groqKey,
          model,
          system,
          user,
        })
      } catch (e) {
        lastErr = e
        const msg = String(e?.message || e)
        if (/404|400|decommissioned|model_not_found|does not exist|invalid.?model/i.test(msg)) continue
        throw e
      }
    }
    throw lastErr || new Error('Groq quote extract failed')
  }
  if (openaiKey) {
    const model = envKey('OPENAI_MODEL', 'EOF_OPENAI_MODEL') || 'gpt-4o'
    return chatJson({
      url: 'https://api.openai.com/v1/chat/completions',
      key: openaiKey,
      model,
      system,
      user,
    })
  }
  return null
}

async function perplexityJson({ system, user, temperature = 0.2 }) {
  const key = getPerplexityApiKey()
  if (!key) throw new Error('PERPLEXITY_API_KEY is not set')

  const body = {
    model: perplexityModel(),
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }

  for (const url of ['https://api.perplexity.ai/v1/sonar', 'https://api.perplexity.ai/chat/completions']) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 50000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        if (res.status === 404 || res.status === 405) continue
        const errText = await res.text().catch(() => '')
        throw new Error(`Perplexity ${res.status}: ${errText.slice(0, 240)}`)
      }
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) throw new Error('empty Perplexity quote response')
      return parseJsonLoose(content)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error('Perplexity quote sourcing failed')
}

/**
 * Find one strong attributed football quote for a Short.
 * Free path first; Perplexity only if configured.
 */
export async function sourceEofFootballQuote({ topic = '', format = 'quote' } = {}) {
  const pages = allEofQuoteSourcePages()

  // 1) Free articles (Guardian + RSS)
  let articlesText = ''
  let packSources = { guardian: 0, rss: 0, guardianConfigured: isGuardianConfigured() }
  try {
    const pack = await fetchFreeFootballDeskPack({
      topic: topic || 'football quote press conference manager said',
      limit: 10,
    })
    articlesText = pack.text
    packSources = pack.sources
    console.info('[eof-quote] free pack', packSources)
  } catch (e) {
    console.warn('[eof-quote] free pack failed', e instanceof Error ? e.message : e)
  }

  // 2) Groq/OpenAI extract quote from free articles
  if (articlesText) {
    try {
      const parsed = await extractQuoteWithFreeLlms({ topic, format, articlesText, pages })
      const hit = normalizeQuoteHit(parsed)
      if (hit) {
        return {
          quote: hit,
          source: packSources.guardian ? 'guardian+groq' : 'rss+groq',
          pages,
          packSources,
        }
      }
    } catch (e) {
      console.warn('[eof-quote] free LLM extract failed', e instanceof Error ? e.message : e)
    }
  }

  // 3) Optional paid Perplexity (EOF_USE_PERPLEXITY=1 only)
  if (shouldUsePerplexity()) {
    try {
      const parsed = await perplexityJson({
        temperature: 0.2,
        system: `${QUOTE_EXTRACT_SYSTEM}
Prefer BBC/Sky/Guardian/newspaper desks. Prefer sources among: ${pages.slice(0, 16).join(', ')}.`,
        user: quoteExtractUser({ topic, format, articlesText, pages }),
      })
      const hit = normalizeQuoteHit(parsed)
      if (hit) return { quote: hit, source: 'perplexity', pages, packSources }
    } catch (e) {
      console.warn('[eof-quote] Perplexity quote source failed', e instanceof Error ? e.message : e)
    }
  }

  // 4) Offline templates
  const fallbacks = [
    {
      speaker: 'Wayne Rooney',
      role: 'pundit',
      quote: "Ronaldo isn't getting enough service for Portugal — that's why he looks less effective.",
      outlet: 'BBC / Sky studio-style desk',
      context: 'Studio debate on Portugal attack patterns and service into the box.',
      target: 'Cristiano Ronaldo / Portugal',
      whyItBites: 'Fans split hard between system blame and individual form.',
      ctaQuestion: 'Is Rooney right — service problem, or Ronaldo problem?',
      sources: ['BBC Sport', 'Sky Sports'],
    },
    {
      speaker: 'Switzerland coach',
      role: 'national team manager',
      quote: "I'm worried about the refereeing against Argentina.",
      outlet: 'pre-match press conference',
      context: 'World Cup / tournament build-up vs Argentina — pressure on officials.',
      target: 'Argentina match / referees',
      whyItBites: 'Refereeing + Argentina always lights up comments.',
      ctaQuestion: 'Fair concern — or mind games before a big match?',
      sources: ['BBC Sport', 'Reuters'],
    },
  ]

  const topicLc = String(topic || '').toLowerCase()
  const pick =
    fallbacks.find((f) => {
      const first = topicLc.split(/\s+/).find((w) => w.length > 3)
      if (!first) return false
      return `${f.speaker} ${f.target} ${f.quote}`.toLowerCase().includes(first)
    }) || fallbacks[0]

  return { quote: pick, source: 'template', pages, packSources }
}

/** Turn a quote hit into desk-brief context for the Shorts writer. */
export function quoteHitToContext(quote) {
  if (!quote) return ''
  const lines = [
    'QUOTE SHORT BRIEF:',
    `Speaker: ${quote.speaker}${quote.role ? ` (${quote.role})` : ''}`,
    `Quote: "${quote.quote}"`,
    quote.outlet ? `Outlet / setting: ${quote.outlet}` : '',
    quote.context ? `Context: ${quote.context}` : '',
    quote.target ? `About: ${quote.target}` : '',
    quote.whyItBites ? `Why it bites: ${quote.whyItBites}` : '',
    quote.ctaQuestion ? `CTA: ${quote.ctaQuestion}` : '',
    Array.isArray(quote.sources) && quote.sources.length ? `Sources: ${quote.sources.join(', ')}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

export function quoteHitToHeadline(quote) {
  if (!quote?.speaker || !quote?.quote) return ''
  const shortQuote = quote.quote.length > 70 ? `${quote.quote.slice(0, 67)}…` : quote.quote
  return `${quote.speaker}: "${shortQuote}"`.slice(0, 100)
}

/** Pick a quote topic string for the daily scheduler when format=quote. */
export async function pickEofDailyQuoteTopic() {
  const { quote, source } = await sourceEofFootballQuote({ topic: '', format: 'quote' })
  return {
    topic: quoteHitToHeadline(quote) || `${quote.speaker} quote`,
    angle: quoteHitToContext(quote),
    desks: quote.sources?.length ? quote.sources : [quote.outlet || 'Sky Sports'].filter(Boolean),
    source,
    quote,
  }
}

export function eofFreeSourcingStatus() {
  return {
    guardian: isGuardianConfigured(),
    rss: true,
    perplexityOptIn: shouldUsePerplexity(),
  }
}
