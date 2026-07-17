/**
 * Caption placement for EOF Shorts — vertical position + size, editable in Production.
 * Burned via ffmpeg drawtext; previewed as an overlay on the admin player.
 */

import { isBottomBarCaptionStyle, resolveEofCaptionStyle } from './eofCaptionStyles.mjs'

/** @typedef {{ yNorm: number, fontScale: number }} EofCaptionLayout */

export const EOF_CAPTION_LAYOUT_Y_MIN = 0.35
export const EOF_CAPTION_LAYOUT_Y_MAX = 0.88
export const EOF_CAPTION_LAYOUT_SCALE_MIN = 0.7
export const EOF_CAPTION_LAYOUT_SCALE_MAX = 1.6

/** 9:16 Short frame width used for drawtext width estimates. */
export const EOF_CAPTION_FRAME_WIDTH = 1080
/**
 * Horizontal safe inset as a fraction of frame width (each side).
 * ~10% keeps free CapCut/local burns out of the left/right corners.
 */
export const EOF_CAPTION_SAFE_X = 0.1
/** Approximate glyph width as a fraction of fontsize (bold Latin caps). */
export const EOF_CAPTION_CHAR_WIDTH = 0.58

/**
 * @param {string} [style]
 * @returns {EofCaptionLayout}
 */
export function defaultEofCaptionLayout(style) {
  const id = resolveEofCaptionStyle(style)
  if (id === 'off') return { yNorm: 0.72, fontScale: 1 }
  if (isBottomBarCaptionStyle(id)) {
    return { yNorm: id === 'punch' ? 0.73 : 0.76, fontScale: 1 }
  }
  // CapCut mid-frame pack
  return { yNorm: 0.52, fontScale: 1 }
}

/**
 * @param {unknown} raw
 * @param {string} [style]
 * @returns {EofCaptionLayout}
 */
export function normalizeEofCaptionLayout(raw, style) {
  const fallback = defaultEofCaptionLayout(style)
  if (!raw || typeof raw !== 'object') return { ...fallback }
  const y = Number(/** @type {{ yNorm?: number }} */ (raw).yNorm)
  const s = Number(/** @type {{ fontScale?: number }} */ (raw).fontScale)
  return {
    yNorm: Number.isFinite(y)
      ? Math.min(EOF_CAPTION_LAYOUT_Y_MAX, Math.max(EOF_CAPTION_LAYOUT_Y_MIN, y))
      : fallback.yNorm,
    fontScale: Number.isFinite(s)
      ? Math.min(EOF_CAPTION_LAYOUT_SCALE_MAX, Math.max(EOF_CAPTION_LAYOUT_SCALE_MIN, s))
      : fallback.fontScale,
  }
}

/**
 * ffmpeg y expression — centers text vertically on the layout line.
 * @param {EofCaptionLayout} layout
 */
export function captionLayoutYExpr(layout) {
  const y = normalizeEofCaptionLayout(layout).yNorm
  return `h*${y.toFixed(3)}-text_h/2`
}

/**
 * ffmpeg x expression — centers text, clamped inside horizontal safe margins.
 * If text is wider than the safe band, pins to the left safe edge (callers should
 * also shrink fontsize / wrap so this is rare).
 */
export function captionLayoutXExpr() {
  const m = EOF_CAPTION_SAFE_X.toFixed(2)
  return `max(w*${m}\\,min((w-text_w)/2\\,w*(${(1 - EOF_CAPTION_SAFE_X).toFixed(2)})-text_w))`
}

/**
 * Max pixel width for caption glyphs inside the safe band.
 * @param {number} [frameWidth]
 */
export function captionSafeMaxWidthPx(frameWidth = EOF_CAPTION_FRAME_WIDTH) {
  const w = Math.max(320, Number(frameWidth) || EOF_CAPTION_FRAME_WIDTH)
  return Math.round(w * (1 - 2 * EOF_CAPTION_SAFE_X))
}

/**
 * Scale a base fontsize (number) by layout.fontScale.
 * @param {number} base
 * @param {EofCaptionLayout} [layout]
 */
export function captionLayoutFontSize(base, layout) {
  const scale = normalizeEofCaptionLayout(layout).fontScale
  return Math.max(28, Math.round(Number(base) * scale))
}

/**
 * Shrink fontsize so estimated text width fits the horizontal safe band.
 * @param {number} base
 * @param {string} text
 * @param {EofCaptionLayout} [layout]
 * @param {{ maxWidth?: number, charWidth?: number, minSize?: number }} [opts]
 */
export function captionFitFontSize(base, text, layout, opts = {}) {
  const maxWidth = Number(opts.maxWidth) || captionSafeMaxWidthPx()
  const charW = Number(opts.charWidth) || EOF_CAPTION_CHAR_WIDTH
  const minSize = Math.max(22, Number(opts.minSize) || 28)
  const desired = captionLayoutFontSize(base, layout)
  const raw = String(text || '')
  if (!raw) return desired
  const est = Math.max(1, raw.length) * desired * charW
  if (est <= maxWidth) return desired
  return Math.max(minSize, Math.floor(desired * (maxWidth / est)))
}

/**
 * Pack words into phrases that fit inside the safe caption width.
 * @param {string[]} words
 * @param {number} fontSize
 * @param {{ maxWidth?: number, charWidth?: number, maxWords?: number }} [opts]
 * @returns {string[]}
 */
export function chunkWordsToSafeWidth(words, fontSize, opts = {}) {
  const list = (Array.isArray(words) ? words : []).map((w) => String(w || '').trim()).filter(Boolean)
  if (!list.length) return ['…']
  const maxWidth = Number(opts.maxWidth) || captionSafeMaxWidthPx()
  const charW = Number(opts.charWidth) || EOF_CAPTION_CHAR_WIDTH
  const maxWords = Math.max(1, Number(opts.maxWords) || 7)
  const fs = Math.max(22, Number(fontSize) || 54)
  const gap = fs * 0.35

  /** @type {string[]} */
  const chunks = []
  let i = 0
  while (i < list.length) {
    let phrase = list[i]
    let width = Math.max(1, phrase.length) * fs * charW
    let count = 1
    i += 1
    while (i < list.length && count < maxWords) {
      const next = list[i]
      const nextW = Math.max(1, next.length) * fs * charW
      if (width + gap + nextW > maxWidth) break
      phrase = `${phrase} ${next}`
      width += gap + nextW
      count += 1
      i += 1
    }
    // Single overlong token — still emit; fontsize fitter handles the rest.
    chunks.push(phrase)
  }
  return chunks
}
