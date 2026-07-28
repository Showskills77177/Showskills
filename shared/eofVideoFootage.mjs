/**
 * EOF real-footage pipeline — pure logic (query building, candidate ranking,
 * copyright-risk scoring, technical gate, clip-window math). No I/O here;
 * yt-dlp / ffmpeg / vision calls live in backend/api/lib/eofVideo*.mjs and
 * call into these pure helpers so the decision logic stays unit-testable.
 */

/** Hard cap on downloaded file size — reject/handle-carefully above this. */
export const EOF_VIDEO_MAX_FILE_BYTES = 100 * 1024 * 1024 // 100MB

/** Reject candidates shorter than this — too little to find a usable moment in. */
export const EOF_VIDEO_MIN_SOURCE_DURATION_SEC = 8

/** Reject candidates longer than this outright — full matches / documentaries, not b-roll. */
export const EOF_VIDEO_MAX_SOURCE_DURATION_SEC = 20 * 60 // 20 minutes

/** Below this resolution the footage looks bad blown up to 1080x1920. */
export const EOF_VIDEO_MIN_HEIGHT = 480

/** Full-match runtime range (association football) — a strong copyright-risk signal. */
const FULL_MATCH_MIN_SEC = 70 * 60
const FULL_MATCH_MAX_SEC = 130 * 60

/** Keywords that make footage SAFER (era / non-broadcast / lower commercial value). */
const SAFE_ERA_KEYWORDS = [
  'classic',
  'throwback',
  'archive',
  'archival',
  'old',
  'retro',
  'young',
  'academy',
  'youth',
  'training',
  'trains',
  'workout',
  'skills',
  'compilation',
  'career',
  'documentary',
  'interview',
  'rare footage',
  'unseen footage',
]

/** Keywords that make footage RISKIER (recent, official broadcast, full commercial rights). */
const RISKY_KEYWORDS = [
  'full match',
  'full game',
  'full highlights 20',
  'official highlights',
  'match highlights',
  'live stream',
  'live match',
  'hd replay',
  'extended highlights',
  '4k highlights',
]

/** Channel/uploader name fragments that signal an official rights-holder broadcast. */
const OFFICIAL_CHANNEL_KEYWORDS = [
  'premier league',
  'uefa',
  'champions league',
  'fifa',
  'espn',
  'sky sports',
  'bt sport',
  'nbc sports',
  'dazn',
  'bein sports',
]

/** Recent-season year strings to flag as a recency risk (rolling window, update yearly). */
const RECENT_YEAR_KEYWORDS = ['2023', '2024', '2025', '2026']

function normalize(s) {
  return String(s || '').toLowerCase().trim()
}

function containsAny(haystack, needles) {
  const h = normalize(haystack)
  return needles.some((n) => h.includes(n))
}

/**
 * Pull a handful of distinctive keywords out of a scene caption/narration to
 * bias the search toward the exact moment described (e.g. "walking pitch son").
 * Pure, cheap stopword filter — not NLP, just enough to steer yt-dlp search.
 * @param {string} caption
 * @param {number} [maxWords]
 */
export function extractEofSceneMomentKeywords(caption, maxWords = 6) {
  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'at', 'for',
    'with', 'is', 'was', 'were', 'be', 'been', 'he', 'she', 'they', 'his',
    'her', 'their', 'it', 'its', 'that', 'this', 'then', 'just', 'not',
    'did', 'does', 'had', 'has', 'have', 'you', 'your', 'i', 'we', 'them',
    'who', 'what', 'why', 'how', 'when', 'never', 'ask', 'asked',
  ])
  const words = normalize(caption)
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => w.length > 2 && !stop.has(w))
  const seen = new Set()
  const out = []
  for (const w of words) {
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= maxWords) break
  }
  return out
}

/**
 * Build an ordered list of search queries — most specific (exact moment) first,
 * progressively more generic, always biased toward safer/older footage.
 * @param {{ subject: string, sceneCaption?: string, topic?: string }} input
 * @returns {string[]}
 */
export function buildEofVideoSearchQueries({ subject, sceneCaption = '', topic = '' } = {}) {
  const who = String(subject || topic || '').trim()
  if (!who) return []
  const momentWords = extractEofSceneMomentKeywords(sceneCaption, 5)
  const queries = []

  // 1. Exact-moment attempt: subject + distinctive scene keywords.
  if (momentWords.length >= 2) {
    queries.push(`${who} ${momentWords.join(' ')}`.trim())
  }
  // 2. Subject + moment keywords + safety bias.
  if (momentWords.length >= 1) {
    queries.push(`${who} ${momentWords.slice(0, 3).join(' ')} footage`.trim())
  }
  // 3. Subject + classic/career framing — good general b-roll, lower risk.
  queries.push(`${who} classic footage compilation`)
  queries.push(`${who} career highlights old`)
  // 4. Training / non-match footage — usually lower production value = lower risk.
  queries.push(`${who} training session`)

  return queries.filter(Boolean).filter((q, i, arr) => arr.indexOf(q) === i).slice(0, 5)
}

/**
 * Score a single candidate's copyright risk from yt-dlp metadata alone (title,
 * channel/uploader, duration, upload date). Pure heuristic — not legal advice,
 * just a first-pass filter to steer away from obvious official broadcast content.
 * @param {{ title?: string, channel?: string, uploader?: string, duration?: number, upload_date?: string }} meta
 * @returns {{ risk: 'low'|'medium'|'high', reasons: string[] }}
 */
export function assessEofVideoCopyrightRisk(meta = {}) {
  const title = String(meta.title || '')
  const channel = String(meta.channel || meta.uploader || '')
  const duration = Number(meta.duration) || 0
  const reasons = []
  let riskPoints = 0

  if (containsAny(title, RISKY_KEYWORDS)) {
    riskPoints += 3
    reasons.push('risky title keywords (full match / official highlights)')
  }
  if (containsAny(channel, OFFICIAL_CHANNEL_KEYWORDS)) {
    riskPoints += 3
    reasons.push('official broadcaster / rights-holder channel')
  }
  if (duration >= FULL_MATCH_MIN_SEC && duration <= FULL_MATCH_MAX_SEC) {
    riskPoints += 3
    reasons.push('duration matches a full match runtime')
  }
  if (containsAny(title, RECENT_YEAR_KEYWORDS)) {
    riskPoints += 1
    reasons.push('title references a recent season/year')
  }
  if (containsAny(title, SAFE_ERA_KEYWORDS) || containsAny(channel, SAFE_ERA_KEYWORDS)) {
    riskPoints -= 2
    reasons.push('era/safety keywords present (classic/training/archive)')
  }

  let risk = 'low'
  if (riskPoints >= 5) risk = 'high'
  else if (riskPoints >= 2) risk = 'medium'

  return { risk, riskPoints, reasons }
}

/**
 * Rank candidates: prefer low risk, then subject-name match in title/channel,
 * then shorter/safer clips over long broadcast-length videos.
 * @param {Array<{ id: string, title?: string, channel?: string, uploader?: string, duration?: number, upload_date?: string }>} candidates
 * @param {{ subject?: string }} [opts]
 */
export function rankEofVideoCandidates(candidates, opts = {}) {
  const subject = normalize(opts.subject || '')
  const scored = (Array.isArray(candidates) ? candidates : []).map((c) => {
    const { risk, riskPoints, reasons } = assessEofVideoCopyrightRisk(c)
    const duration = Number(c.duration) || 0
    let score = 10 - riskPoints
    const title = normalize(c.title)
    const channel = normalize(c.channel || c.uploader)
    if (subject && (title.includes(subject) || channel.includes(subject))) score += 2
    if (duration > 0 && duration < 5 * 60) score += 1 // short clips are easier/safer
    if (duration > EOF_VIDEO_MAX_SOURCE_DURATION_SEC) score -= 4
    if (duration > 0 && duration < EOF_VIDEO_MIN_SOURCE_DURATION_SEC) score -= 4
    return { ...c, risk, riskPoints, riskReasons: reasons, rankScore: score }
  })
  return scored.sort((a, b) => b.rankScore - a.rankScore)
}

/**
 * Technical Quality Gate: file size / duration / resolution sanity checks.
 * Pure — caller does the actual ffprobe and passes plain numbers in.
 * @param {{ sizeBytes?: number, durationSec?: number, width?: number, height?: number }} input
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function assessEofVideoTechnicalGate({ sizeBytes, durationSec, width, height } = {}) {
  const reasons = []
  const size = Number(sizeBytes) || 0
  const dur = Number(durationSec) || 0
  const h = Number(height) || 0

  if (size <= 0) reasons.push('file missing or empty')
  if (size > EOF_VIDEO_MAX_FILE_BYTES) {
    reasons.push(`file too heavy (${Math.round(size / 1024 / 1024)}MB > 100MB cap)`)
  }
  if (dur > 0 && dur < EOF_VIDEO_MIN_SOURCE_DURATION_SEC) {
    reasons.push('source clip too short to find a usable moment')
  }
  if (dur > EOF_VIDEO_MAX_SOURCE_DURATION_SEC) {
    reasons.push('source too long (looks like a full match/documentary)')
  }
  if (h > 0 && h < EOF_VIDEO_MIN_HEIGHT) {
    reasons.push(`resolution too low (${h}p < ${EOF_VIDEO_MIN_HEIGHT}p)`)
  }

  return { pass: reasons.length === 0, reasons }
}

/**
 * Given a source video's duration and a best-matching timestamp (from vision
 * frame-matching), compute a clean [startSec, endSec] window sized to the
 * scene's target duration, clamped to the source's bounds.
 * @param {{ sourceDurationSec: number, targetDurationSec: number, bestTimestampSec?: number|null }} input
 */
export function resolveEofVideoClipWindow({
  sourceDurationSec,
  targetDurationSec,
  bestTimestampSec = null,
} = {}) {
  const srcDur = Math.max(0, Number(sourceDurationSec) || 0)
  const want = Math.max(1, Number(targetDurationSec) || 3)
  if (srcDur <= 0) return { startSec: 0, endSec: want }
  const clipDur = Math.min(want, srcDur)
  const center =
    bestTimestampSec != null && Number.isFinite(Number(bestTimestampSec))
      ? Number(bestTimestampSec)
      : srcDur / 2
  let start = center - clipDur / 2
  start = Math.max(0, Math.min(start, srcDur - clipDur))
  return { startSec: start, endSec: start + clipDur }
}
