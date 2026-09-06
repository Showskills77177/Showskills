/**
 * Grok vision re-rank for EOF Shorts stills.
 * One batch call per Short (not per scene): right person? era? watermark? face clear?
 *
 * Quality bar: correct lead subject or reject — never “close enough” group shots.
 */
import { getXaiApiKey, isXaiConfigured, xaiModelCandidates } from './eofXaiClient.mjs'
import {
  hitMentionsSubject,
  subjectNameCues,
  MIN_EOF_VISION_SCORE,
  filterHitsRequiringSubjectNameCue,
  isNamedFootballSubject,
} from '../../../shared/eofSceneImageQueries.mjs'
import { isEofVercelRuntime } from './eofProductionServerless.mjs'

export { MIN_EOF_VISION_SCORE }

/** Hard budget for Grok vision — on Vercel this must not burn 25s of the 300s isolate. */
export function eofImageVisionTimeoutMs() {
  const fromEnv = Number(process.env.EOF_IMAGE_VISION_TIMEOUT_MS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  return isEofVercelRuntime() ? 10_000 : 25_000
}

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

function personLabelMatchesSubject(personLabel, subject) {
  const label = String(personLabel || '').trim()
  if (!label) return null // unknown — don't force-fail on empty label
  if (/^(unknown|unclear|n\/a|none|various|group|multiple|crowd)/i.test(label)) return false
  return hitMentionsSubject(subject, label, '')
}

/**
 * True when the model's detected era clearly conflicts with the requested intent —
 * e.g. a Short about a pundit/coach TODAY should not accept an old "playing days" action
 * shot (and vice versa). "unknown"/"other" never conflicts (model wasn't sure — don't punish).
 * @param {string} intent
 * @param {string} era
 */
function eraConflictsWithIntent(intent, era) {
  const i = String(intent || '').toLowerCase()
  const e = String(era || '').toLowerCase()
  if (!e || e === 'unknown' || e === 'other') return false
  if (i === 'neutral' || !i) return false
  return i !== e
}

/**
 * Apply hard-fail clamps from a vision row (wrong face, watermark, meme text, wrong era).
 * Exported for unit tests.
 * @param {{
 *   score?: number,
 *   person?: string,
 *   watermark?: boolean,
 *   burned_captions?: boolean,
 *   subject_visible?: boolean,
 *   era?: string,
 * }} row
 * @param {string} subject
 * @param {string[]} [secondarySubjects]
 * @param {{ intent?: string }} [opts]
 * @returns {{ score: number, rejected: boolean, reason: string }}
 */
export function clampEofVisionRow(row, subject, secondarySubjects = [], opts = {}) {
  let s = Number(row?.score)
  if (!Number.isFinite(s)) {
    return { score: 0, rejected: true, reason: 'non-numeric score' }
  }
  const reasons = []

  if (row?.watermark === true) {
    s = Math.min(s, 2)
    reasons.push('watermark')
  }
  if (row?.burned_captions === true) {
    s = Math.min(s, 2)
    reasons.push('burned_captions')
  }
  if (row?.subject_visible === false) {
    s = Math.min(s, 1)
    reasons.push('subject_not_visible')
  }

  const personMatch = personLabelMatchesSubject(row?.person, subject)
  if (personMatch === false) {
    // Model named someone else — only forgive if a secondary is the intended label
    // AND lead is somehow still marked visible (rare dual shot). Prefer fail.
    const secs = (secondarySubjects || []).filter(Boolean)
    const personIsSecondary = secs.some((sec) => hitMentionsSubject(sec, String(row?.person || ''), ''))
    if (!personIsSecondary || row?.subject_visible === false) {
      s = Math.min(s, 1)
      reasons.push(`wrong_person:${String(row?.person || '').slice(0, 40)}`)
    }
  }

  // Era/context mismatch — Cucurella-class bug: a "playing days" Chelsea action shot
  // passed a pundit-era Short because era wasn't checked at all. Don't hard-fail (era
  // detection is fuzzy on thumbnails) but cap well below the keep bar so it loses to
  // any correctly-era-matched candidate in the same pool.
  if (eraConflictsWithIntent(opts.intent, row?.era)) {
    s = Math.min(s, 3)
    reasons.push(`era_mismatch:${row.era}_vs_${opts.intent}`)
  }

  s = Math.max(0, Math.min(10, s))
  const rejected = s < MIN_EOF_VISION_SCORE
  return {
    score: s,
    rejected,
    reason: reasons.length ? reasons.join(',') : rejected ? `score_below_${MIN_EOF_VISION_SCORE}` : 'ok',
  }
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
    .slice(0, Math.max(4, Math.min(isEofVercelRuntime() ? 4 : 10, Number(opts.maxImages) || 8)))
  if (hits.length < 2) return scores

  const subject = String(opts.subject || 'football person').trim()
  const intent = String(opts.intent || 'neutral')
  const secondary = (opts.secondarySubjects || []).filter(Boolean).slice(0, 2)
  const key = getXaiApiKey()
  const model = xaiModelCandidates()[0] || 'grok-2-latest'
  const { surname } = subjectNameCues(subject)

  const catalog = hits
    .map((h, i) => `${i + 1}. ${h.url}\n   title: ${h.title || '(none)'}`)
    .join('\n')

  const system = `You are an Eyes Of Football stills editor. Score Google Image candidates for a vertical Short.
Return JSON only: { "scores": [ { "index": number, "score": number, "person": string, "era": "pundit"|"playing"|"coach"|"other"|"unknown", "watermark": boolean, "burned_captions": boolean, "subject_visible": boolean, "reason": string } ] }
Rules:
- score 0–10. Prefer a CLEAR, identifiable SOLO face of the LEAD subject (clean press photo, not a graphic).
- person = who is actually visible (real name). If the lead is absent, name whoever IS in frame.
- HARD fail (score ≤1, subject_visible=false) if the lead subject ("${subject}") is NOT clearly in the frame — e.g. random other footballers posing, stock couples, unrelated group shots, wrong celebrity. Titles lie; trust the pixels.
- HARD fail (score ≤2) if watermark/banner/Getty overlay, or unusable crop.
- HARD fail (score ≤2, burned_captions=true) for meme/quote cards, collage graphics, or any still with large burned-in captions/text overlays — we burn our own Shorts captions on top and those stack.
- Group photos: score ≤3 unless the lead (${surname || subject}) is the obvious main person (largest/closest face). Prefer solo portraits (score 7–10).
- For intent "${intent}": pundit = studio/suit/TV now; playing = kit/action; coach = sideline/presser.
- If a secondary person is needed (${secondary.join(', ') || 'none'}), note them in person when visible — but NEVER pass a still that lacks the lead subject.
- Correct person or fail. Never “close enough”.`

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
      signal: AbortSignal.timeout(eofImageVisionTimeoutMs()),
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
    let rejected = 0
    for (const row of list) {
      const idx = Number(row?.index) - 1
      if (idx < 0 || idx >= hits.length) continue
      const clamped = clampEofVisionRow(row, subject, secondary, { intent })
      scores.set(hits[idx].url, clamped.score)
      if (clamped.rejected) {
        rejected += 1
        console.info(
          '[eof-vision] reject wrong/weak still',
          subject.slice(0, 40),
          clamped.reason,
          `score=${clamped.score}`,
          String(hits[idx].title || hits[idx].url).slice(0, 80),
        )
      }
    }
    console.info(
      '[eof-vision] ranked',
      scores.size,
      '/',
      hits.length,
      'for',
      subject.slice(0, 40),
      `intent=${intent}`,
      `kept_ge_${MIN_EOF_VISION_SCORE}=${[...scores.values()].filter((v) => v >= MIN_EOF_VISION_SCORE).length}`,
      `rejected=${rejected}`,
    )
  } catch (e) {
    console.warn('[eof-vision] skipped', e instanceof Error ? e.message : e)
  }
  return scores
}

/**
 * Merge vision scores onto hit objects (mutates copies).
 * STRICT: when vision returned any scores, DROP unscored hits and scores below MIN.
 * On equal vision scores, prefer real scrape photos over AI gen stills.
 * @param {Array<{ url: string, title?: string|null, width?: number, height?: number, source?: string, visionScore?: number }>} hits
 * @param {Map<string, number>} visionScores
 * @param {{ minScore?: number }} [opts]
 */
export function applyVisionScoresToHits(hits, visionScores, opts = {}) {
  if (!Array.isArray(hits) || !(visionScores instanceof Map) || !visionScores.size) {
    return Array.isArray(hits) ? hits : []
  }
  const minScore = Number.isFinite(opts.minScore) ? Number(opts.minScore) : MIN_EOF_VISION_SCORE
  const isGen = (h) => {
    const s = String(h?.source || '')
    return s === 'grok-imagine' || s === 'free-gen'
  }
  const ranked = hits
    .map((h) => {
      const vs = visionScores.get(h.url)
      return {
        ...h,
        visionScore: Number.isFinite(vs) ? vs : null,
      }
    })
    // Fail closed: unscored URLs (beyond the vision batch, or model skipped index) are dropped.
    .filter((h) => {
      if (h.visionScore == null) {
        console.info(
          '[eof-vision] drop unscored hit',
          String(h.title || h.url || '').slice(0, 90),
        )
        return false
      }
      if (h.visionScore < minScore) {
        console.info(
          '[eof-vision] drop low score',
          `score=${h.visionScore}`,
          String(h.title || h.url || '').slice(0, 90),
        )
        return false
      }
      return true
    })
    .sort((a, b) => {
      const diff = (b.visionScore ?? 0) - (a.visionScore ?? 0)
      if (diff !== 0) return diff
      return (isGen(a) ? 1 : 0) - (isGen(b) ? 1 : 0)
    })
  return ranked
}

/**
 * Vision re-rank with a strict subject-name fallback only when vision produced
 * no evaluation. Completed low-score evaluations remain rejected.
 *
 * @param {Array<{ url: string, title?: string|null, source?: string, localPath?: string }>} hits
 * @param {string} subject
 * @param {Map<string, number>} visionScores
 * @param {{ query?: string }} [opts]
 */
export function applyVisionScoresWithNameCueFallback(hits, subject, visionScores, opts = {}) {
  const hasVisionScores = visionScores instanceof Map && visionScores.size > 0
  const ranked = hasVisionScores ? applyVisionScoresToHits(hits, visionScores) : []
  if (ranked.length) return ranked
  if (!Array.isArray(hits) || !hits.length) return ranked
  if (!isNamedFootballSubject(subject)) return ranked
  if (
    hasVisionScores &&
    [...visionScores.values()].some((score) => Number.isFinite(Number(score)))
  ) {
    return ranked
  }
  const fallback = filterHitsRequiringSubjectNameCue(hits, subject, {
    query: opts.query || '',
    log: false,
  })
  if (fallback.length) {
    console.warn(
      '[eof-vision] pool emptied by vision — name-cue fallback kept',
      fallback.length,
      'still(s) for',
      String(subject).slice(0, 40),
    )
  }
  return fallback
}
