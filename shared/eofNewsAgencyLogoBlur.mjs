/**
 * Detect news / agency plates (Fox, Sky, Getty, Reuters, AP, …) and build
 * ffmpeg fragments that boxblur corner logo / watermark zones — not the whole frame.
 *
 * Env:
 *   EOF_NEWS_LOGO_BLUR=0|off     disable
 *   EOF_NEWS_LOGO_BLUR_LR=10     boxblur luma radius
 *   EOF_NEWS_LOGO_BLUR_LP=2      boxblur luma power
 *   EOF_NEWS_LOGO_BLUR_CORNER_W=0.22   corner patch width (frac of frame)
 *   EOF_NEWS_LOGO_BLUR_CORNER_H=0.075  corner patch height (frac of frame)
 */

/** Host / CDN cues for news bugs + agency plates. */
const NEWS_AGENCY_HOST =
  /\b(foxnews|fox\.com|static\.foxnews|a57\.foxnews|sky\.com|skysports|e\d*\.365dm|gettyimages|media\.gettyimages|static\.gettyimages|reuters|static\.reuters|apnews|apimages|media\.ap\.org|bbc\.co\.uk|bbci\.co\.uk|ichef\.bbci|cnn\.com|cdn\.cnn|itv\.com|espncdn|espn\.com|dailymail|i\.dailymail|thesun\.co|mirror\.co|guim\.co\.uk|nytimes|static01\.nyt|washingtonpost|nbcsports|cbssports|bleacherreport|sportingnews|goal\.com|telegraaf|bild\.de|marca\.com|as\.com|lequipe)\b/i

/** Title / attribution text cues (often present when CDN host is opaque). */
const NEWS_AGENCY_TEXT =
  /\b(getty\s*images?|fox\s*news|sky\s*sports|sky\s*news|reuters|associated\s*press|\bap\s*photo\b|\bap\s*images?\b|bbc\s*sport|cnn|espn|daily\s*mail|the\s*sun|mirror\s*football|pa\s*images?|press\s*association|afp\s*photo|shutterstock|alamy)\b/i

/** Search-provider sources that are editorial plates with corner bugs. */
const NEWS_AGENCY_IMAGE_SOURCES = new Set(['ap'])

/**
 * Pull an http(s) URL out of an imageKey like `oxylabs:https://…` or `google:https://…`.
 * @param {string} [imageKey]
 * @returns {string}
 */
export function extractUrlFromEofImageKey(imageKey) {
  const key = String(imageKey || '').trim()
  if (!key) return ''
  const m = key.match(/https?:\/\/[^\s]+/i)
  return m ? m[0] : ''
}

/**
 * @param {{
 *   imageUrl?: string | null,
 *   imageKey?: string | null,
 *   imageTitle?: string | null,
 *   sourcePage?: string | null,
 *   imageSource?: string | null,
 * }} [meta]
 * @returns {{ match: boolean, agency: string | null, reasons: string[] }}
 */
export function detectEofNewsAgencyStill(meta = {}) {
  const imageUrl = String(meta.imageUrl || '').trim()
  const imageKey = String(meta.imageKey || '').trim()
  const imageTitle = String(meta.imageTitle || '').trim()
  const sourcePage = String(meta.sourcePage || '').trim()
  const imageSource = String(meta.imageSource || '')
    .trim()
    .toLowerCase()
  const keyUrl = extractUrlFromEofImageKey(imageKey)
  const urlHay = [imageUrl, keyUrl, sourcePage].filter(Boolean).join(' ')
  const textHay = [imageTitle, sourcePage, imageKey].filter(Boolean).join(' ')
  const reasons = []
  let agency = null

  if (NEWS_AGENCY_IMAGE_SOURCES.has(imageSource)) {
    reasons.push(`source:${imageSource}`)
    agency = agency || imageSource
  }
  if (urlHay && NEWS_AGENCY_HOST.test(urlHay)) {
    const hostHit = urlHay.match(NEWS_AGENCY_HOST)
    reasons.push(`host:${hostHit?.[1] || 'news'}`)
    agency = agency || String(hostHit?.[1] || 'news').toLowerCase()
  }
  if (textHay && NEWS_AGENCY_TEXT.test(textHay)) {
    const textHit = textHay.match(NEWS_AGENCY_TEXT)
    reasons.push(`text:${textHit?.[1] || 'agency'}`)
    agency = agency || String(textHit?.[1] || 'agency').toLowerCase().replace(/\s+/g, '-')
  }

  return {
    match: reasons.length > 0,
    agency,
    reasons,
  }
}

/**
 * @param {Parameters<typeof detectEofNewsAgencyStill>[0]} meta
 */
export function stillNeedsNewsAgencyLogoBlur(meta) {
  if (!isEofNewsAgencyLogoBlurEnabled()) return false
  return detectEofNewsAgencyStill(meta).match
}

export function isEofNewsAgencyLogoBlurEnabled() {
  const raw = String(process.env.EOF_NEWS_LOGO_BLUR || '1').trim().toLowerCase()
  return raw !== '0' && raw !== 'off' && raw !== 'false' && raw !== 'no'
}

function readPositiveNumber(envKey, fallback) {
  const n = Number(process.env[envKey])
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Corner watermark patches (TL / TR / BL / BR) in pixel space.
 * @param {{ frameW?: number, frameH?: number, cornerWFrac?: number, cornerHFrac?: number }} [opts]
 */
export function resolveNewsAgencyLogoBlurRegions(opts = {}) {
  const frameW = Math.max(64, Math.round(Number(opts.frameW) || 1080))
  const frameH = Math.max(64, Math.round(Number(opts.frameH) || 1920))
  const wFrac = Number(opts.cornerWFrac)
  const hFrac = Number(opts.cornerHFrac)
  const cornerWFrac = Number.isFinite(wFrac) && wFrac > 0
    ? wFrac
    : readPositiveNumber('EOF_NEWS_LOGO_BLUR_CORNER_W', 0.22)
  const cornerHFrac = Number.isFinite(hFrac) && hFrac > 0
    ? hFrac
    : readPositiveNumber('EOF_NEWS_LOGO_BLUR_CORNER_H', 0.075)
  const w = Math.max(48, Math.min(frameW, Math.round(frameW * cornerWFrac)))
  const h = Math.max(36, Math.min(frameH, Math.round(frameH * cornerHFrac)))
  const xR = Math.max(0, frameW - w)
  const yB = Math.max(0, frameH - h)
  return [
    { id: 'tl', x: 0, y: 0, w, h },
    { id: 'tr', x: xR, y: 0, w, h },
    { id: 'bl', x: 0, y: yB, w, h },
    { id: 'br', x: xR, y: yB, w, h },
  ]
}

/**
 * Filtergraph fragment: split → crop+boxblur per corner → overlay back.
 * Expects unlabeled video in; produces unlabeled video out (safe to `,fps=…` after).
 * Label prefix must be unique when base + pop both blur in one filter_complex.
 *
 * @param {{
 *   frameW?: number,
 *   frameH?: number,
 *   labelPrefix?: string,
 *   blurLr?: number,
 *   blurLp?: number,
 *   cornerWFrac?: number,
 *   cornerHFrac?: number,
 * }} [opts]
 * @returns {string} empty when disabled / no regions
 */
export function buildNewsAgencyLogoBlurFilterFragment(opts = {}) {
  if (!isEofNewsAgencyLogoBlurEnabled()) return ''
  const regions = resolveNewsAgencyLogoBlurRegions(opts)
  if (!regions.length) return ''

  const prefix = String(opts.labelPrefix || 'nlb').replace(/[^a-zA-Z0-9_]/g, '') || 'nlb'
  const lr = Math.max(
    2,
    Math.round(Number(opts.blurLr) || readPositiveNumber('EOF_NEWS_LOGO_BLUR_LR', 10)),
  )
  const lp = Math.max(
    1,
    Math.round(Number(opts.blurLp) || readPositiveNumber('EOF_NEWS_LOGO_BLUR_LP', 2)),
  )

  const n = regions.length
  // split=N+1 → main + one pad per corner
  const splitPads = [`${prefix}_main`, ...regions.map((r) => `${prefix}_${r.id}`)]
  const parts = [`split=${n + 1}${splitPads.map((p) => `[${p}]`).join('')}`]

  for (const r of regions) {
    parts.push(
      `[${prefix}_${r.id}]crop=${r.w}:${r.h}:${r.x}:${r.y},boxblur=${lr}:${lp}[${prefix}_${r.id}b]`,
    )
  }

  let cur = `${prefix}_main`
  for (let i = 0; i < regions.length; i += 1) {
    const r = regions[i]
    const next = i === regions.length - 1 ? null : `${prefix}_t${i}`
    const overlay = `[${cur}][${prefix}_${r.id}b]overlay=${r.x}:${r.y}`
    parts.push(next ? `${overlay}[${next}]` : overlay)
    if (next) cur = next
  }

  return parts.join(';')
}
