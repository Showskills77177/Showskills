/**
 * Desk research for EOF Short scripts.
 * Pulls free public football RSS headlines, then builds a structured brief
 * the Shorts writer must follow (so drafts are sourced, not book essays).
 */
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'

const RSS_FEEDS = [
  { desk: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/rss.xml' },
  { desk: 'The Guardian', url: 'https://www.theguardian.com/football/rss' },
  { desk: 'Sky Sports', url: 'https://www.skysports.com/rss/12040' },
]

function stripTags(html) {
  return String(html || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseRssItems(xml, desk) {
  const items = []
  const chunks = String(xml || '').split(/<item[\s>]/i).slice(1)
  for (const chunk of chunks.slice(0, 25)) {
    const title = stripTags((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(chunk) || [])[1] || '')
    const description = stripTags(
      (/<description[^>]*>([\s\S]*?)<\/description>/i.exec(chunk) || [])[1] || '',
    ).slice(0, 280)
    const link = stripTags((/<link[^>]*>([\s\S]*?)<\/link>/i.exec(chunk) || [])[1] || '')
    if (title.length >= 8) items.push({ desk, title, description, link })
  }
  return items
}

function topicTokens(topic) {
  return String(topic || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !/^(the|and|for|with|from|this|that|news|latest|update|world|cup|football)$/.test(w))
}

/**
 * Fetch recent football headlines from public RSS (no API key).
 * @returns {Promise<Array<{ desk: string, title: string, description: string, link: string }>>}
 */
export async function fetchFootballDeskHeadlines({ topic = '', limit = 8 } = {}) {
  const tokens = topicTokens(topic)
  const all = []

  await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        const res = await fetch(feed.url, {
          signal: controller.signal,
          headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        })
        clearTimeout(timer)
        if (!res.ok) return
        const xml = await res.text()
        all.push(...parseRssItems(xml, feed.desk))
      } catch (e) {
        console.warn('[eof-desk] RSS failed', feed.desk, e instanceof Error ? e.message : e)
      }
    }),
  )

  const scored = all
    .map((item) => {
      const hay = `${item.title} ${item.description}`.toLowerCase()
      const hits = tokens.filter((t) => hay.includes(t)).length
      return { ...item, hits }
    })
    .sort((a, b) => b.hits - a.hits || a.title.localeCompare(b.title))

  const preferred = scored.filter((i) => i.hits > 0)
  const pool = preferred.length ? preferred : scored
  const seen = new Set()
  const out = []
  for (const item of pool) {
    const key = item.title.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      desk: item.desk,
      title: item.title.slice(0, 140),
      description: item.description.slice(0, 240),
      link: item.link.slice(0, 240),
    })
    if (out.length >= limit) break
  }
  return out
}

export function formatDeskHeadlinesForPrompt(headlines) {
  if (!Array.isArray(headlines) || !headlines.length) return ''
  return headlines
    .map((h, i) => `${i + 1}. [${h.desk}] ${h.title}${h.description ? ` — ${h.description}` : ''}`)
    .join('\n')
}

/**
 * System prompt for the desk-research model (pass 1).
 */
export function buildDeskResearchSystemPrompt() {
  return `You are a senior football news desk editor for Eyes Of Football YouTube Shorts.

${EOF_FOOTBALL_SCOPE}

Your job is NOT to write the Short. Build a tight DESK BRIEF the Shorts writer will use.

SOURCING RULES:
- Prefer the provided RSS headlines / desk notes when they match the topic.
- Write like you have read Sky Sports, BBC Sport, ESPN FC, The Athletic, Marca, L'Équipe.
- Name which desk style the story fits (match fallout, transfer, injury, managerial, World Cup race).
- Use only widely reported / defensible facts. If a score/quote is uncertain, mark it uncertain — never invent exact scores or fake quotes.
- Do NOT invent transfers, retirements, comebacks, injuries, sackings, or appointments. If the topic is a legacy/debate angle, keep facts to reputation and known career peaks — put invented live events in "avoid".
- Always say football — never soccer. Never American football / NFL.

Return JSON only.`
}

/**
 * User prompt for desk research.
 */
export function buildDeskResearchUserPrompt({ topic, format, context, headlinesText }) {
  return `Topic: ${topic}
Format: ${format || 'news'}
${context ? `\nExisting context:\n${context}\n` : ''}
${headlinesText ? `\nLive desk headlines (use if relevant; ignore if unrelated):\n${headlinesText}\n` : '\nNo live headlines available — use widely reported public football knowledge only.\n'}
Return JSON:
{
  "headline": "specific Shorts-ready headline with teams/players (max 90 chars)",
  "storyType": "match_fallout|transfer|injury|managerial|world_cup|debate|career|listicle",
  "sourceDesks": ["BBC Sport","Sky Sports"],
  "facts": ["3-6 short bullet facts the VO can use"],
  "stakes": "one sentence why fans care now",
  "hookAngle": "the opening hook idea in one line",
  "ctaQuestion": "one sharp comment question",
  "avoid": ["things not to invent or pad with — e.g. fake transfers, retirements, comebacks, injuries, sackings"]
}`
}

/**
 * Turn research JSON into plain context for the Shorts writer.
 */
export function deskBriefToContext(brief) {
  if (!brief || typeof brief !== 'object') return ''
  const lines = []
  if (brief.headline) lines.push(`Headline: ${brief.headline}`)
  if (brief.storyType) lines.push(`Story type: ${brief.storyType}`)
  if (Array.isArray(brief.sourceDesks) && brief.sourceDesks.length) {
    lines.push(`Desk style: ${brief.sourceDesks.map(String).slice(0, 4).join(', ')}`)
  }
  if (Array.isArray(brief.facts) && brief.facts.length) {
    lines.push('Facts:')
    for (const f of brief.facts.slice(0, 6)) lines.push(`- ${String(f).trim()}`)
  }
  if (brief.stakes) lines.push(`Stakes: ${brief.stakes}`)
  if (brief.hookAngle) lines.push(`Hook: ${brief.hookAngle}`)
  if (brief.ctaQuestion) lines.push(`CTA: ${brief.ctaQuestion}`)
  if (Array.isArray(brief.avoid) && brief.avoid.length) {
    lines.push(`Avoid: ${brief.avoid.map(String).slice(0, 5).join('; ')}`)
  }
  return lines.join('\n')
}
