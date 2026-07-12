/**
 * Perplexity Sonar — live web-grounded football research for EOF scripts.
 * Yesterday's plan: Sonar sources articles/citations; Groq/OpenAI writes the Short.
 *
 * Env:
 *   PERPLEXITY_API_KEY / EOF_PERPLEXITY_API_KEY
 *   PERPLEXITY_MODEL (default sonar-pro)
 */
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function getPerplexityApiKey() {
  return envKey('PERPLEXITY_API_KEY', 'EOF_PERPLEXITY_API_KEY')
}

export function isPerplexityConfigured() {
  return Boolean(getPerplexityApiKey())
}

export function perplexityModel() {
  return envKey('PERPLEXITY_MODEL', 'EOF_PERPLEXITY_MODEL') || 'sonar-pro'
}

function extractCitations(data) {
  const out = []
  const seen = new Set()
  const push = (url, title = '') => {
    const u = String(url || '').trim()
    if (!u || seen.has(u)) return
    seen.add(u)
    out.push({ url: u.slice(0, 300), title: String(title || '').trim().slice(0, 140) })
  }

  if (Array.isArray(data?.citations)) {
    for (const c of data.citations) {
      if (typeof c === 'string') push(c)
      else if (c && typeof c === 'object') push(c.url || c.link, c.title)
    }
  }
  if (Array.isArray(data?.search_results)) {
    for (const r of data.search_results) {
      push(r?.url || r?.link, r?.title)
    }
  }
  return out.slice(0, 8)
}

async function postSonar({ messages, temperature = 0.2, timeoutMs = 45000 }) {
  const key = getPerplexityApiKey()
  if (!key) throw new Error('PERPLEXITY_API_KEY is not set')

  const body = {
    model: perplexityModel(),
    temperature,
    messages,
  }

  const endpoints = [
    'https://api.perplexity.ai/v1/sonar',
    'https://api.perplexity.ai/chat/completions',
  ]

  let lastError = null
  for (const url of endpoints) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastError = new Error(`Perplexity ${res.status}: ${errText.slice(0, 240)}`)
        if (res.status === 404 || res.status === 405) continue
        throw lastError
      }
      return await res.json()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (String(lastError.message || '').includes('404') || String(lastError.message || '').includes('405')) {
        continue
      }
      // Abort / network → try next endpoint once
      if (url === endpoints[0]) continue
      throw lastError
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError || new Error('Perplexity Sonar request failed')
}

/**
 * Live web research for a football Short topic.
 * @returns {Promise<{ text: string, citations: Array<{url:string,title:string}>, source: 'perplexity' } | null>}
 */
export async function researchFootballTopicWithPerplexity({ topic, format = 'news' } = {}) {
  if (!isPerplexityConfigured()) return null
  const t = String(topic || '').trim()
  if (t.length < 2) return null

  const system = `You are a football news researcher for Eyes Of Football YouTube Shorts.

${EOF_FOOTBALL_SCOPE}

Return a tight DESK NOTES block (not a finished Short script):
- 5–8 bullet facts grounded in current public reporting
- Name clubs/nations/players clearly
- Always say football — never soccer
- Never invent exact scores or fake quotes; say "reported" / "narrow win" if unsure
- Prefer Sky Sports / BBC Sport / ESPN FC / The Athletic / Reuters / AP-style reporting
- Include a one-line "Story angle" and one "CTA question"
- Keep under 180 words`

  const user = `Research this football Short topic and return desk notes only:
Topic: ${t}
Format hint: ${format}

Focus on what happened, why it matters now, and what comes next.`

  const data = await postSonar({
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
  })

  const text = String(data?.choices?.[0]?.message?.content || data?.output_text || '').trim()
  if (!text || text.length < 40) throw new Error('empty Perplexity research')

  const citations = extractCitations(data)
  return { text, citations, source: 'perplexity' }
}

/** Format Perplexity research + citations for the desk-brief / draft prompts. */
export function formatPerplexityResearchForPrompt(research) {
  if (!research?.text) return ''
  const lines = ['LIVE WEB RESEARCH (Perplexity Sonar — use these facts; do not invent beyond them):', research.text]
  if (Array.isArray(research.citations) && research.citations.length) {
    lines.push('Sources:')
    for (const c of research.citations.slice(0, 6)) {
      lines.push(`- ${c.title ? `${c.title} — ` : ''}${c.url}`)
    }
  }
  return lines.join('\n')
}
