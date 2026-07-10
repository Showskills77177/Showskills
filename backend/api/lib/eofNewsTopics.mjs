/**
 * European football news topic picker — Sky Sports / ESPN / ITV Sport desk style.
 * Uses Grok 4.5 to propose today's most Short-worthy European football stories.
 */
import { EOF_EUROPEAN_FOOTBALL_SCOPE } from '../../../shared/eofScriptTemplates.mjs'
import { isXaiConfigured, xaiJsonCompletion } from './eofXaiClient.mjs'

export const EOF_NEWS_DESKS = [
  'Sky Sports',
  'ESPN FC',
  'ITV Sport',
  'BBC Sport',
  'The Athletic',
  'Goal.com',
  'Marca',
  'L\'Équipe',
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
        system: `You are a European football news editor for Eyes Of Football YouTube Shorts.

${EOF_EUROPEAN_FOOTBALL_SCOPE}

Write like the most respected sports desks: ${EOF_NEWS_DESKS.join(', ')}.
Pick CURRENT, Short-worthy European football stories (transfers, injuries, managerial, match fallout, contracts).
Do NOT invent fake breaking news with invented scores or quotes. Prefer widely discussed real storylines; if unsure of exact details, keep the headline general but still specific (club + player + situation).
Never include American football / NFL.`,
        user: `Return JSON with ${count} topics for today's European football Shorts:
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
      headline: 'Premier League transfer window: who moves next?',
      angle: 'Desk-style look at the biggest European transfer storylines fans are arguing about.',
      desks: ['Sky Sports', 'The Athletic'],
      whyNow: 'Transfer chatter drives Shorts comments every day.',
    },
    {
      headline: 'Champions League nights that still decide careers',
      angle: 'UCL pressure stories from Europe’s biggest clubs.',
      desks: ['ITV Sport', 'ESPN FC'],
      whyNow: 'European nights always travel on Shorts.',
    },
    {
      headline: 'Managerial hot seats across Europe’s top five leagues',
      angle: 'Who is under pressure after the latest run of results.',
      desks: ['Sky Sports', 'BBC Sport'],
      whyNow: 'Manager news converts into debate CTAs.',
    },
    {
      headline: 'Injury updates reshaping title races',
      angle: 'Key absences and what they mean for the table.',
      desks: ['ESPN FC', 'Goal.com'],
      whyNow: 'Injury news is timely and visual.',
    },
    {
      headline: 'La Liga / Serie A / Bundesliga storylines fans missed',
      angle: 'Cross-league European football angles beyond the Premier League.',
      desks: ['Marca', "L'Équipe"],
      whyNow: 'Broadens Eyes Of Football beyond one league.',
    },
  ]
}

/** Pick a single topic string for the daily scheduler. */
export async function pickEofDailyNewsTopic() {
  const { topics, source } = await pickEofEuropeanFootballNewsTopics({ count: 5 })
  const first = topics[0]
  return {
    topic: first?.headline || 'Premier League transfer window: who moves next?',
    angle: first?.angle || '',
    desks: first?.desks || ['Sky Sports'],
    source,
  }
}
