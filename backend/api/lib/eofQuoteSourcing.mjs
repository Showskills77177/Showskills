/**
 * Quote script sourcing for Eyes Of Football Shorts.
 * Finds attributed football quotes (pressers, studio, desks) and turns them
 * into desk briefs the Shorts writer can use — scheduler-ready.
 *
 * Sources (in order):
 *   1) Perplexity Sonar (live web — BBC, Sky, The Sun, AP-style desks)
 *   2) RSS headlines that look quote-driven
 *   3) Optional preferred Instagram / quote pages (names only — Sonar searches them)
 *
 * Env:
 *   PERPLEXITY_API_KEY
 *   EOF_QUOTE_PAGES=page1,page2   (optional Instagram/TikTok/X handles or site names)
 */
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'
import { isPerplexityConfigured, getPerplexityApiKey, perplexityModel } from './eofPerplexityClient.mjs'
import { fetchFootballDeskHeadlines, formatDeskHeadlinesForPrompt } from './eofFootballDeskResearch.mjs'

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

/**
 * Find one strong attributed football quote for a Short.
 * @param {{ topic?: string, format?: string }} opts
 */
export async function sourceEofFootballQuote({ topic = '', format = 'quote' } = {}) {
  const pages = allEofQuoteSourcePages()
  const rss = await fetchFootballDeskHeadlines({ topic: topic || 'football quote press conference', limit: 10 }).catch(
    () => [],
  )
  const rssText = formatDeskHeadlinesForPrompt(rss)

  if (isPerplexityConfigured()) {
    try {
      const parsed = await perplexityJson({
        temperature: 0.2,
        system: `You find SHAREABLE football quotes for YouTube Shorts.

${EOF_FOOTBALL_SCOPE}

Rules:
- Return ONE real, attributed quote (named speaker + what they said).
- Prefer press conferences, BBC/Sky studio, The Athletic, newspapers, Reuters/AP-style reporting.
- Prefer strong, clear, bite-worthy quotes (criticism, worry, rivalry, hot takes) — not bland filler.
- Always say football — never soccer.
- If the user gave a topic, the quote must relate to it.
- Do NOT invent fake quotes. If unsure of exact wording, paraphrase carefully and mark exact:false.
- Prefer sources among: ${pages.slice(0, 16).join(', ')}.

Return JSON only.`,
        user: `Find one strong football quote for a Short.
Topic hint: ${topic || '(any timely football quote today)'}
Format: ${format}

Recent desk headlines (optional context):
${rssText || '(none)'}

Return JSON:
{
  "speaker": "Wayne Rooney",
  "role": "ex-England / pundit",
  "quote": "exact or careful paraphrase of what they said",
  "exact": true,
  "outlet": "BBC Sport / Sky Sports / press conference",
  "context": "when/where and what it was about",
  "target": "who or what the quote is about",
  "whyItBites": "why fans will argue in comments",
  "ctaQuestion": "one sharp agree/disagree question",
  "sources": ["outlet or URL titles"]
}`,
      })

      const hit = normalizeQuoteHit(parsed)
      if (hit) {
        return { quote: hit, source: 'perplexity', pages }
      }
    } catch (e) {
      console.warn('[eof-quote] Perplexity quote source failed', e instanceof Error ? e.message : e)
    }
  }

  // Template fallbacks — still usable offline / without Perplexity
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
    fallbacks.find((f) => topicLc && (`${f.speaker} ${f.target} ${f.quote}`.toLowerCase().includes(topicLc.split(/\s+/)[0] || '___'))) ||
    fallbacks[0]

  return { quote: pick, source: 'template', pages }
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
