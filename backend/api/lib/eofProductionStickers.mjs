/**
 * EOF Production — FFmpeg overlay of Stickers & Elements (PNG catalog).
 * Catalog / normalize live in shared/eofStickersElements.mjs.
 *
 * Burn order: footage (+ image-over-image) → effects → stickers → captions.
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EOF_DEFAULT_STICKERS,
  EOF_MAX_STICKERS,
  EOF_STICKERS_STACKING_RULE,
  normalizeEofStickers,
  planEofStickerOverlays,
  eofStickersActive,
  eofStickerIds,
  summarizeEofStickers,
  listEofStickersCatalog,
  listEofStickerPositions,
  listEofStickersByCategory,
  pickEofSticker,
  setEofStickerPosition,
  stickerOverlayXY,
} from '../../../shared/eofStickersElements.mjs'

export {
  EOF_DEFAULT_STICKERS,
  EOF_MAX_STICKERS,
  EOF_STICKERS_STACKING_RULE,
  normalizeEofStickers,
  planEofStickerOverlays,
  eofStickersActive,
  eofStickerIds,
  summarizeEofStickers,
  listEofStickersCatalog,
  listEofStickerPositions,
  listEofStickersByCategory,
  pickEofSticker,
  setEofStickerPosition,
  stickerOverlayXY,
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

const STICKER_DIR_CANDIDATES = [
  process.env.EOF_STICKERS_DIR,
  join(ROOT, 'backend/api/assets/stickers'),
  join(ROOT, 'public/eof-stickers'),
  join(ROOT, 'assets/eof/stickers'),
].filter(Boolean)

/**
 * Resolve absolute path to a sticker PNG asset filename.
 * @param {string} assetName
 * @returns {string | null}
 */
export function resolveEofStickerAssetPath(assetName) {
  const name = String(assetName || '')
    .replace(/^\/+/, '')
    .trim()
  if (!name || name.includes('..') || name.includes('/')) return null
  for (const dir of STICKER_DIR_CANDIDATES) {
    const abs = join(dir, name)
    if (existsSync(abs)) return abs
  }
  return null
}

/** Escape a path for FFmpeg movie= filter. */
export function escapeFfmpegMoviePath(absPath) {
  return String(absPath || '')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}

/**
 * Build filter_complex fragments that overlay planned stickers onto an input label.
 * Stickers burn under captions — call this before caption filters.
 *
 * @param {{
 *   stickers?: unknown,
 *   inputLabel?: string,
 *   outputLabel?: string,
 * }} opts
 * @returns {{
 *   filter: string,
 *   outputLabel: string,
 *   count: number,
 *   missing: string[],
 *   plan: ReturnType<typeof planEofStickerOverlays>,
 * }}
 */
export function buildEofStickerOverlayFilter({
  stickers,
  inputLabel = 'vin',
  outputLabel = 'vstick',
} = {}) {
  const plan = planEofStickerOverlays(stickers)
  if (!plan.length) {
    return { filter: '', outputLabel: inputLabel, count: 0, missing: [], plan }
  }

  /** @type {string[]} */
  const parts = []
  /** @type {string[]} */
  const missing = []
  let last = inputLabel
  let applied = 0
  for (const row of plan) {
    const abs = resolveEofStickerAssetPath(row.asset)
    if (!abs) {
      missing.push(row.asset)
      continue
    }
    const stLabel = `st${applied}`
    const nextLabel = `vs${applied}`
    parts.push(
      `movie='${escapeFfmpegMoviePath(abs)}',scale=${row.widthPx}:-1,format=rgba[${stLabel}]`,
    )
    parts.push(`[${last}][${stLabel}]overlay=x=${row.x}:y=${row.y}:format=auto[${nextLabel}]`)
    last = nextLabel
    applied += 1
  }

  if (!applied) {
    return { filter: '', outputLabel: inputLabel, count: 0, missing, plan }
  }

  if (last !== outputLabel) {
    parts.push(`[${last}]null[${outputLabel}]`)
  }

  return {
    filter: parts.join(';'),
    outputLabel,
    count: applied,
    missing,
    plan,
  }
}

/**
 * Chain stickers then captions after a prior video label (e.g. vfx / comp).
 * @param {string} inputLabel
 * @param {unknown} stickers
 * @param {string[]} captionChain
 * @returns {{ filter: string, missing: string[], count: number }}
 */
export function chainStickersThenCaptions(inputLabel, stickers, captionChain = []) {
  const sticker = buildEofStickerOverlayFilter({
    stickers,
    inputLabel,
    outputLabel: 'vstick',
  })
  const after = sticker.count ? sticker.outputLabel : inputLabel
  /** @type {string[]} */
  const parts = []
  if (sticker.filter) parts.push(sticker.filter)

  const caps = Array.isArray(captionChain) ? captionChain.filter(Boolean) : []
  if (caps.length) {
    parts.push(`[${after}]${caps.join(',')}[vout]`)
  } else if (after !== 'vout') {
    parts.push(`[${after}]null[vout]`)
  }

  return {
    filter: parts.join(';'),
    missing: sticker.missing,
    count: sticker.count,
  }
}
