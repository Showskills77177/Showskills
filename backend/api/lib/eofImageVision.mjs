/**
 * Grok vision re-rank for EOF Shorts stills.
 * One batch call per Short (not per scene): right person? era? watermark? face clear?
 */
import { getXaiApiKey, isXaiConfigured, xaiModelCandidates } from './eofXaiClient.mjs'

function envKey(...names) {
  for (const name of names) {
    const v = (process.env[name] || '').trim()
    if (v) return v
  }
  return ''
}

export function isEofImageVisionConfigured() {
  if (!isXaiConfigured()) return false
  const off = String(envKey('EOF_IMAGE_VISION') || 'auto').toLowerCase()
  return off !== '0' && off !== 'off' && off !== 'false'
}

function parseJsonContent(content) {
  const raw = String(content || '').trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```\s*$/i.exec(raw)
  const body = fenced ? fenced[1].trim() : raw
  return JSON.parse(body)
}

/**
 * Ask Grok to score candidate stills for a subject + role intent.
 * @param {{
 *   hits: Array<{ url: string, title?: string|null }>,
 *   subject: string,
 *   intent?: string,
 *   secondarySubjects?: string[],
 *   maxImages?: number,
 * }} opts
 * @returns {Promise<Map<string, number>>} url → vision score 0–10
 */
export async function rankEofPoolHitsWithVision(opts = {}) {
  const scores = new Map()
  if (!isEofImageVisionConfigured()) return scores

  const hits = (Array.isArray(opts.hits) ? opts.hits : [])
    .filter((h) => h?.url && /^https?:\/\//i.test(h.url))
    .slice(0, Math.max(4, Math.min(10, Number(opts.maxImages) || 8)))
  if (hits.length < 2) return scores

  const subject = String(opts.subject || 'football person').trim()
  const intent = String(opts.intent || 'neutral')
  const secondary = (opts.secondarySubjects || []).filter(Boolean).slice(0, 2)
  const key = getXaiApiKey()
  const model = xaiModelCandidates()[0] || 'grok-2-latest'

  const catalog = hits
    .map((h, i) => `${i + 1}. ${h.url}\n   title: ${h.title || '(none)'}`)
    .join('\n')

  const system = `You are an Eyes Of Football stills editor. Score Google Image candidates for a vertical Short.
Return JSON only: { "scores": [ { "index": number, "score": number, "person": string, "era": "pundit"|"playing"|"coach"|"other"|"unknown", "watermark": boolean, "reason": string } ] }
Rules:
- score 0–10. Prefer clear face of the RIGHT person.
- For intent "${intent}": pundit = studio/suit/TV now; playing = kit/action; coach = sideline/presser.
- HARD fail (score ≤2) if watermark/banner/Getty overlay, wrong person, or unusable crop.
- If a secondary person is needed (${secondary.join(', ') || 'none'}), note them in person when visible.`

  const userContent = [
    {
      type: 'text',
      text: `Lead subject: ${subject}
Intent: ${intent}
Secondary subjects to also accept when clearly visible: ${secondary.join(', ') || '(none)'}

Candidates:
${catalog}

Score every index 1–${hits.length}.`,
    },
    ...hits.map((h) => ({
      type: 'image_url',
      image_url: { url: h.url, detail: 'low' },
    })),
  ]

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(55_000),
    })
    if (!res.ok) {
      const err = await res.text().catch(() => '')
      console.warn('[eof-vision] xAI vision failed', res.status, err.slice(0, 160))
      return scores
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    const parsed = parseJsonContent(content)
    const list = Array.isArray(parsed?.scores) ? parsed.scores : []
    for (const row of list) {
      const idx = Number(row?.index) - 1
      if (idx < 0 || idx >= hits.length) continue
      let s = Number(row?.score)
      if (!Number.isFinite(s)) continue
      if (row?.watermark === true) s = Math.min(s, 2)
      s = Math.max(0, Math.min(10, s))
      scores.set(hits[idx].url, s)
    }
    console.info('[eof-vision] ranked', scores.size, '/', hits.length, 'for', subject.slice(0, 40), `intent=${intent}`)
  } catch (e) {
    console.warn('[eof-vision] skipped', e instanceof Error ? e.message : e)
  }
  return scores
}

/**
 * Merge vision scores onto hit objects (mutates copies).
 * @param {Array<{ url: string, title?: string|null, width?: number, height?: number, visionScore?: number }>} hits
 * @param {Map<string, number>} visionScores
 */
export function applyVisionScoresToHits(hits, visionScores) {
  if (!Array.isArray(hits) || !(visionScores instanceof Map) || !visionScores.size) {
    return Array.isArray(hits) ? hits : []
  }
  return hits
    .map((h) => {
      const vs = visionScores.get(h.url)
      return {
        ...h,
        visionScore: Number.isFinite(vs) ? vs : null,
      }
    })
    .filter((h) => h.visionScore == null || h.visionScore >= 3)
    .sort((a, b) => (b.visionScore ?? 5) - (a.visionScore ?? 5))
}
