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
 * Scale a base fontsize (number) by layout.fontScale.
 * @param {number} base
 * @param {EofCaptionLayout} [layout]
 */
export function captionLayoutFontSize(base, layout) {
  const scale = normalizeEofCaptionLayout(layout).fontScale
  return Math.max(28, Math.round(Number(base) * scale))
}
