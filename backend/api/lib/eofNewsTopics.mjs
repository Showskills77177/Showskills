/**
 * Football news topic picker — Sky Sports / ESPN / ITV Sport desk style.
 * Worldwide association football (World Cup 2026 included). Always call it football — never soccer.
 */
import { EOF_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'
import { isXaiConfigured, xaiJsonCompletion } from './eofXaiClient.mjs'

export const EOF_NEWS_DESKS = [
  'Sky Sports',
  'ESPN FC',
  'ITV Sport',
  'BBC Sport',
  'The Athletic',
  'Goal.com',
  'Marca',
  "L'Équipe",
]

/**
 * @param {{ count?: number }} [opts]
 * @returns {Promise<{ topics: Array<{ headline: string, angle: string, desks: string[], whyNow: string }>, source: string }>}
 */
export async function pickEofEuropeanFootballNewsTopics(opts = {}) {
  const count = Math.min(8, Math.max(1, Number(opts.count) || 5))

  if (isXaiConfigured()) {
    try {
      const parsed = await xaiJsonCompletion({
        temperature: 0.4,
        system: `You are a football news editor for Eyes Of Football YouTube Shorts.

${EOF_FOOTBALL_SCOPE}

Write like the most respected sports desks: ${EOF_NEWS_DESKS.join(', ')}.
Pick CURRENT, Short-worthy football stories worldwide (World Cup 2026, transfers, injuries, managerial, match fallout, contracts, international windows).
Always call it football — never soccer.
Do NOT invent fake breaking news with invented scores or quotes. Prefer widely discussed real storylines; if unsure of exact details, keep the headline general but still specific (club/nation + player + situation).
Never include American football / NFL.`,
        user: `Return JSON with ${count} topics for today's football Shorts:
{
  "topics": [
    {
      "headline": "short YouTube-ready headline (max 80 chars)",
      "angle": "one sentence newsroom angle",
      "desks": ["Sky Sports","ESPN FC"],
      "whyNow": "why this is timely for Shorts today"
    }
  ]
}`,
      })

      const topics = Array.isArray(parsed?.topics)
        ? parsed.topics
            .map((t) => ({
              headline: String(t?.headline || '').trim().slice(0, 100),
              angle: String(t?.angle || '').trim().slice(0, 240),
              desks: Array.isArray(t?.desks) ? t.desks.map(String).slice(0, 4) : ['Sky Sports'],
              whyNow: String(t?.whyNow || '').trim().slice(0, 200),
            }))
            .filter((t) => t.headline.length >= 8)
            .slice(0, count)
        : []

      if (topics.length) return { topics, source: 'xai' }
    } catch (e) {
      console.warn('[eof-news] Grok topic pick failed', e instanceof Error ? e.message : e)
    }
  }

  return {
    topics: fallbackNewsTopics().slice(0, count),
    source: 'template',
  }
}

function fallbackNewsTopics() {
  return [
    {
      headline: 'Spain edge Belgium — World Cup statement win',
      angle: 'Spain look like contenders after a disciplined win over Belgium on the World Cup stage.',
      desks: ['Sky Sports', 'ESPN FC'],
      whyNow: 'World Cup knockout / group nights drive Shorts comments instantly.',
    },
    {
      headline: 'England under pressure after another World Cup scare',
      angle: 'Tournament nerves, late goals, and the same debate: style vs results.',
      desks: ['ITV Sport', 'BBC Sport'],
      whyNow: 'England World Cup nights always travel on Shorts.',
    },
    {
      headline: 'Brazil’s World Cup favourites tag is back under the microscope',
      angle: 'Talent everywhere — but tournament football punishes soft moments.',
      desks: ["L'Équipe", 'ESPN FC'],
      whyNow: 'Favourites narrative is perfect for debate CTAs.',
    },
    {
      headline: 'Premier League transfer window: who moves next?',
      angle: 'Desk-style look at the biggest transfer storylines fans are arguing about.',
      desks: ['Sky Sports', 'The Athletic'],
      whyNow: 'Transfer chatter drives Shorts comments every day.',
    },
    {
      headline: 'Messi, Mbappé, Haaland — who owns the World Cup narrative?',
      angle: 'Global superstars and what the tournament is asking of them now.',
      desks: ['ESPN FC', 'Goal.com'],
      whyNow: 'Star power + World Cup = Shorts engagement.',
    },
  ]
}

/**
 * Expand a vague topic ("world cup news") into one concrete football brief.
 * @param {{ topic: string, format?: string }} input
 */
export async function resolveEofScriptBrief({ topic, format, scriptProvider } = {}) {
  const raw = String(topic || '').trim()
  if (raw.length < 2) throw new Error('Topic is required.')

  const vague =
    /^(world\s*cup|wc|football|soccer|euro|ucl|premier\s*league)?\s*(news|update|updates|headlines|today|latest)?$/i.test(
      raw,
    ) ||
    /^(latest|today'?s?|breaking)\s+(world\s*cup|football|soccer)?\s*news$/i.test(raw) ||
    (raw.split(/\s+/).length <= 3 && /\b(news|update|latest|headlines)\b/i.test(raw))

  if (!vague && raw.split(/\s+/).length >= 5) {
    return { topic: raw, context: '', resolved: false, source: 'user' }
  }

  const wantsWorldCup = /\bworld\s*cup\b|\bwc26\b|\bwc\s*2026\b/i.test(raw)
  const pick = String(scriptProvider || '').toLowerCase()
  const skipXai = pick === 'groq'
  const groqKey = (process.env.GROQ_API_KEY || process.env.EOF_GROQ_API_KEY || '').trim()

  const resolveSystem = `You are a football news editor for Eyes Of Football YouTube Shorts.

${EOF_FOOTBALL_SCOPE}

The user gave a VAGUE topic. Pick ONE specific, Short-worthy football story they can narrate today.
${wantsWorldCup ? 'Prefer a FIFA World Cup 2026 story (any nation — match result, group race, knockout stakes, star player moment).' : 'Prefer a timely club or international football story from anywhere in the world.'}
Rules:
- Always call it football — never soccer.
- Name real teams / players / competitions when you are reasonably sure.
- Do NOT invent exact scores you are unsure about — say "narrow win", "statement result", "late drama" instead.
- Never American football / NFL.
- Write like Sky Sports / ESPN FC / BBC Sport.`

  const resolveUser = `Vague topic: "${raw}"
Format hint: ${format || 'news'}

Return JSON only:
{
  "headline": "specific YouTube-ready headline with teams/players (max 90 chars)",
  "angle": "2-3 sentences of desk facts / stakes the narrator can use",
  "whyNow": "why this is timely"
}`

  async function finishResolve(parsed, source) {
    const headline = String(parsed?.headline || '').trim()
    const angle = String(parsed?.angle || '').trim()
    const whyNow = String(parsed?.whyNow || '').trim()
    if (headline.length < 12) return null
    return {
      topic: headline.slice(0, 100),
      context: [angle, whyNow].filter(Boolean).join('\n'),
      resolved: true,
      source,
    }
  }

  if (groqKey && (pick === 'groq' || pick === 'auto' || !pick)) {
    try {
      const model = (process.env.GROQ_MODEL || process.env.EOF_GROQ_MODEL || 'llama-3.3-70b-versatile').trim()
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: resolveSystem },
            { role: 'user', content: resolveUser },
          ],
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const rawContent = data?.choices?.[0]?.message?.content || ''
        const parsed = JSON.parse(rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''))
        const done = await finishResolve(parsed, 'groq')
        if (done) return done
      }
    } catch (e) {
      console.warn('[eof-news] Groq resolve failed', e instanceof Error ? e.message : e)
    }
  }

  if (isXaiConfigured() && !skipXai) {
    try {
      const parsed = await xaiJsonCompletion({
        temperature: 0.3,
        system: resolveSystem,
        user: resolveUser,
      })
      const done = await finishResolve(parsed, 'xai')
      if (done) return done
    } catch (e) {
      console.warn('[eof-news] resolve brief failed', e instanceof Error ? e.message : e)
    }
  }

  const pool = wantsWorldCup
    ? fallbackNewsTopics().filter((t) => /world cup/i.test(t.headline))
    : fallbackNewsTopics()
  const fallback = pool[0] || fallbackNewsTopics()[0]
  return {
    topic: fallback.headline,
    context: [fallback.angle, fallback.whyNow].filter(Boolean).join('\n'),
    resolved: true,
    source: 'template',
  }
}

/** Pick a single topic string for the daily scheduler. */
export async function pickEofDailyNewsTopic() {
  const { topics, source } = await pickEofEuropeanFootballNewsTopics({ count: 5 })
  const first = topics[0]
  return {
    topic: first?.headline || 'Spain edge Belgium — World Cup statement win',
    angle: first?.angle || '',
    desks: first?.desks || ['Sky Sports'],
    source,
  }
}
