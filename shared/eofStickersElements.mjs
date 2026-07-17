/**
 * CapCut-style Stickers & Elements for Eyes Of Football Production Shorts.
 *
 * Stacking: up to EOF_MAX_STICKERS elements. Burned after footage effects / image-over-image,
 * under captions so subtitle text stays readable.
 *
 * Default positions avoid the upper pop card when possible:
 *   Subscribe / Follow → top_right
 *   Arrows / accents → upper_third or corners
 *   Shapes → upper_third / lower_third_safe (above caption band)
 */

/** @typedef {'buttons' | 'shapes' | 'arrows' | 'stickers'} EofStickerCategory */
/** @typedef {'top' | 'upper_third' | 'lower_third_safe' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right'} EofStickerPositionId */

/**
 * @typedef {object} EofStickerCatalogItem
 * @property {string} id
 * @property {EofStickerCategory} category
 * @property {string} label
 * @property {string} detail
 * @property {string} vibe
 * @property {string} [asset] filename under stickers dir
 * @property {EofStickerPositionId} defaultPosition
 * @property {number} [widthPx]
 * @property {'png' | 'draw'} [render]
 * @property {Record<string, unknown>} [draw]
 */

/**
 * @typedef {object} EofStickerSelectionItem
 * @property {string} id
 * @property {EofStickerPositionId} position
 * @property {boolean} [enabled]
 */

/**
 * @typedef {object} EofStickersSelection
 * @property {EofStickerSelectionItem[]} items
 */

export const EOF_MAX_STICKERS = 3

export const EOF_DEFAULT_STICKERS = Object.freeze({ items: Object.freeze([]) })

export const EOF_STICKERS_STACKING_RULE =
  'Pick up to 3 elements. Burned under captions (after effects). Subscribe defaults to top-right — clears the image-over-image upper card.'

/** @type {Array<{ id: EofStickerPositionId, label: string, detail: string, vibe: string }>} */
export const EOF_STICKER_POSITIONS = [
  {
    id: 'top',
    label: 'Top',
    detail: 'Centered near the top edge (safe below status bar).',
    vibe: 'Center · top',
  },
  {
    id: 'upper_third',
    label: 'Upper third',
    detail: 'Mid-upper band. Prefer corners for Subscribe when image-over-image is on.',
    vibe: 'Upper',
  },
  {
    id: 'lower_third_safe',
    label: 'Lower third (safe)',
    detail: 'Above the subtitle band so captions stay readable.',
    vibe: 'Safe · above subs',
  },
  {
    id: 'top_left',
    label: 'Top left',
    detail: 'Corner — may sit near brand watermark.',
    vibe: 'Corner',
  },
  {
    id: 'top_right',
    label: 'Top right',
    detail: 'Default for Subscribe / Follow — clears upper pop card.',
    vibe: 'Corner · CTA',
  },
  {
    id: 'bottom_left',
    label: 'Bottom left',
    detail: 'Lower corner, still above captions.',
    vibe: 'Corner',
  },
  {
    id: 'bottom_right',
    label: 'Bottom right',
    detail: 'Lower corner, still above captions.',
    vibe: 'Corner',
  },
]

/** @type {EofStickerCatalogItem[]} */
export const EOF_STICKERS_CATALOG = [
  // —— Buttons ——
  {
    id: 'btn_subscribe_yt',
    category: 'buttons',
    label: 'Subscribe',
    detail: 'YouTube-red Subscribe badge — bold mobile CTA.',
    vibe: 'YT · red',
    asset: 'subscribe-yt.png',
    defaultPosition: 'top_right',
    widthPx: 300,
    render: 'png',
  },
  {
    id: 'btn_follow_tt',
    category: 'buttons',
    label: 'Follow',
    detail: 'TikTok-style follow chip — black pill + accent.',
    vibe: 'TT · chip',
    asset: 'follow-tt.png',
    defaultPosition: 'top_right',
    widthPx: 260,
    render: 'png',
  },
  // —— Arrows ——
  {
    id: 'arrow_left',
    category: 'arrows',
    label: 'Arrow left',
    detail: 'Bold chevron pointing left.',
    vibe: '←',
    asset: 'arrow-left.png',
    defaultPosition: 'upper_third',
    widthPx: 160,
    render: 'png',
  },
  {
    id: 'arrow_right',
    category: 'arrows',
    label: 'Arrow right',
    detail: 'Bold chevron pointing right.',
    vibe: '→',
    asset: 'arrow-right.png',
    defaultPosition: 'upper_third',
    widthPx: 160,
    render: 'png',
  },
  {
    id: 'arrow_up',
    category: 'arrows',
    label: 'Arrow up',
    detail: 'Bold chevron pointing up.',
    vibe: '↑',
    asset: 'arrow-up.png',
    defaultPosition: 'top',
    widthPx: 140,
    render: 'png',
  },
  {
    id: 'arrow_down',
    category: 'arrows',
    label: 'Arrow down',
    detail: 'Bold chevron pointing down — good toward CTA / captions.',
    vibe: '↓',
    asset: 'arrow-down.png',
    defaultPosition: 'lower_third_safe',
    widthPx: 140,
    render: 'png',
  },
  // —— Shapes ——
  {
    id: 'shape_square',
    category: 'shapes',
    label: 'Square',
    detail: 'Solid white square accent.',
    vibe: 'Solid',
    asset: 'shape-square.png',
    defaultPosition: 'upper_third',
    widthPx: 120,
    render: 'png',
  },
  {
    id: 'shape_square_outline',
    category: 'shapes',
    label: 'Square outline',
    detail: 'Outlined square frame.',
    vibe: 'Outline',
    asset: 'shape-square-outline.png',
    defaultPosition: 'upper_third',
    widthPx: 140,
    render: 'png',
  },
  {
    id: 'shape_circle',
    category: 'shapes',
    label: 'Circle',
    detail: 'Solid white circle.',
    vibe: 'Solid',
    asset: 'shape-circle.png',
    defaultPosition: 'upper_third',
    widthPx: 120,
    render: 'png',
  },
  {
    id: 'shape_circle_outline',
    category: 'shapes',
    label: 'Circle outline',
    detail: 'Outlined circle ring.',
    vibe: 'Outline',
    asset: 'shape-circle-outline.png',
    defaultPosition: 'upper_third',
    widthPx: 140,
    render: 'png',
  },
  {
    id: 'shape_rounded',
    category: 'shapes',
    label: 'Rounded rect',
    detail: 'Soft rounded rectangle plate.',
    vibe: 'Soft',
    asset: 'shape-rounded.png',
    defaultPosition: 'lower_third_safe',
    widthPx: 280,
    render: 'png',
  },
  {
    id: 'shape_line',
    category: 'shapes',
    label: 'Line',
    detail: 'Horizontal accent bar.',
    vibe: 'Bar',
    asset: 'shape-line.png',
    defaultPosition: 'lower_third_safe',
    widthPx: 360,
    render: 'png',
  },
  // —— Stickers / extras ——
  {
    id: 'sticker_fire',
    category: 'stickers',
    label: 'Fire accent',
    detail: 'Minimal flame shape — hype beat accent (original, emoji-free).',
    vibe: 'Hype',
    asset: 'fire-accent.png',
    defaultPosition: 'top_left',
    widthPx: 110,
    render: 'png',
  },
  {
    id: 'sticker_new',
    category: 'stickers',
    label: 'NEW',
    detail: 'Bold NEW badge for drops / lineups.',
    vibe: 'Badge',
    asset: 'badge-new.png',
    defaultPosition: 'top_left',
    widthPx: 160,
    render: 'png',
  },
  {
    id: 'sticker_tap',
    category: 'stickers',
    label: 'Tap hand',
    detail: 'Simple tap/click hand pointer — original outline.',
    vibe: 'CTA',
    asset: 'tap-hand.png',
    defaultPosition: 'lower_third_safe',
    widthPx: 130,
    render: 'png',
  },
]

const CATALOG_BY_ID = new Map(EOF_STICKERS_CATALOG.map((item) => [item.id, item]))
const POSITION_IDS = new Set(EOF_STICKER_POSITIONS.map((p) => p.id))

export function listEofStickersCatalog() {
  return EOF_STICKERS_CATALOG.map((item) => ({ ...item }))
}

export function listEofStickerPositions() {
  return EOF_STICKER_POSITIONS.map((p) => ({ ...p }))
}

export function listEofStickersByCategory(category) {
  const cat = String(category || '')
    .trim()
    .toLowerCase()
  return EOF_STICKERS_CATALOG.filter((item) => item.category === cat).map((item) => ({ ...item }))
}

/**
 * @param {unknown} raw
 * @returns {EofStickerPositionId}
 */
export function resolveEofStickerPosition(raw, fallback = 'top_right') {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
  if (POSITION_IDS.has(id)) return /** @type {EofStickerPositionId} */ (id)
  const fb = String(fallback || 'top_right')
    .trim()
    .toLowerCase()
  return POSITION_IDS.has(fb) ? /** @type {EofStickerPositionId} */ (fb) : 'top_right'
}

/**
 * @param {unknown} raw
 * @returns {EofStickerCatalogItem | null}
 */
export function getEofStickerById(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
  return CATALOG_BY_ID.get(id) || null
}

/**
 * Normalize persisted / API stickers selection. Max 3 unique catalog ids; default none.
 * Accepts `{ items: [...] }`, a bare array, or JSON string.
 * @param {unknown} raw
 * @returns {EofStickersSelection}
 */
export function normalizeEofStickers(raw) {
  if (raw == null || raw === '') {
    return { items: [] }
  }
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return { items: [] }
    }
  }

  /** @type {unknown[]} */
  let list = []
  if (Array.isArray(obj)) {
    list = obj
  } else if (typeof obj === 'object' && obj) {
    const row = /** @type {Record<string, unknown>} */ (obj)
    if (Array.isArray(row.items)) list = row.items
    else if (Array.isArray(row.stickers)) list = row.stickers
    else if (Array.isArray(row.elements)) list = row.elements
    else if (Array.isArray(row.elements_json)) list = row.elements_json
  } else {
    return { items: [] }
  }

  /** @type {EofStickerSelectionItem[]} */
  const items = []
  const seen = new Set()
  for (const entry of list) {
    if (items.length >= EOF_MAX_STICKERS) break
    if (entry == null) continue
    if (typeof entry === 'string') {
      const catalog = getEofStickerById(entry)
      if (!catalog || seen.has(catalog.id)) continue
      seen.add(catalog.id)
      items.push({
        id: catalog.id,
        position: catalog.defaultPosition,
        enabled: true,
      })
      continue
    }
    if (typeof entry !== 'object') continue
    const row = /** @type {Record<string, unknown>} */ (entry)
    if (row.enabled === false) continue
    const catalog = getEofStickerById(row.id || row.stickerId || row.elementId)
    if (!catalog || seen.has(catalog.id)) continue
    seen.add(catalog.id)
    items.push({
      id: catalog.id,
      position: resolveEofStickerPosition(row.position, catalog.defaultPosition),
      enabled: true,
    })
  }
  return { items }
}

/**
 * Toggle / add / update a sticker in the selection (max 3).
 * Passing the same id again with `remove: true` or when already selected removes it.
 * @param {EofStickersSelection | null | undefined} current
 * @param {string} stickerId
 * @param {{ position?: unknown, remove?: boolean } | undefined} [opts]
 * @returns {EofStickersSelection}
 */
export function pickEofSticker(current, stickerId, opts = {}) {
  const base = normalizeEofStickers(current)
  const catalog = getEofStickerById(stickerId)
  if (!catalog) return base

  const remove = Boolean(opts?.remove) || base.items.some((i) => i.id === catalog.id)
  if (remove && opts?.remove !== false) {
    // Explicit remove, or toggle-off when already selected (and no new position forced).
    if (opts?.remove === true || opts?.position === undefined) {
      return { items: base.items.filter((i) => i.id !== catalog.id) }
    }
  }

  const position = resolveEofStickerPosition(opts?.position, catalog.defaultPosition)
  const existingIdx = base.items.findIndex((i) => i.id === catalog.id)
  if (existingIdx >= 0) {
    const next = base.items.map((item, i) =>
      i === existingIdx ? { id: catalog.id, position, enabled: true } : item,
    )
    return { items: next }
  }
  if (base.items.length >= EOF_MAX_STICKERS) {
    // Replace oldest when at cap and user picks a new card.
    return {
      items: [...base.items.slice(1), { id: catalog.id, position, enabled: true }],
    }
  }
  return {
    items: [...base.items, { id: catalog.id, position, enabled: true }],
  }
}

/**
 * Set position on a selected sticker (no-op if not selected).
 * @param {EofStickersSelection | null | undefined} current
 * @param {string} stickerId
 * @param {unknown} position
 */
export function setEofStickerPosition(current, stickerId, position) {
  const base = normalizeEofStickers(current)
  const catalog = getEofStickerById(stickerId)
  if (!catalog) return base
  const pos = resolveEofStickerPosition(position, catalog.defaultPosition)
  return {
    items: base.items.map((item) =>
      item.id === catalog.id ? { ...item, position: pos } : item,
    ),
  }
}

export function eofStickersActive(raw) {
  return normalizeEofStickers(raw).items.length > 0
}

/** Stable list of selected sticker ids. */
export function eofStickerIds(raw) {
  return normalizeEofStickers(raw).items.map((i) => i.id)
}

/**
 * Human-readable summary for admin UI / logs.
 * @param {unknown} raw
 */
export function summarizeEofStickers(raw) {
  const { items } = normalizeEofStickers(raw)
  if (!items.length) return 'Off'
  return items
    .map((item) => {
      const cat = getEofStickerById(item.id)
      return cat ? `${cat.label} (${item.position.replace(/_/g, ' ')})` : item.id
    })
    .join(' · ')
}

/**
 * FFmpeg overlay x/y expressions for a named position on 1080×1920 (W,H main; w,h overlay).
 * lower_third_safe / bottom corners sit above the default caption band (~bottom 22%).
 * @param {unknown} position
 * @param {{ pad?: number }} [opts]
 * @returns {{ x: string, y: string }}
 */
export function stickerOverlayXY(position, opts = {}) {
  const pad = Math.max(12, Math.min(80, Number(opts.pad) || 36))
  const pos = resolveEofStickerPosition(position)
  const left = String(pad)
  const right = `W-w-${pad}`
  const centerX = '(W-w)/2'
  // Keep bottom placements above typical subtitle band (~0.72–0.88).
  const captionClear = 300
  switch (pos) {
    case 'top':
      return { x: centerX, y: String(pad + 28) }
    case 'upper_third':
      return { x: centerX, y: 'H*0.16' }
    case 'lower_third_safe':
      return { x: centerX, y: 'H*0.58' }
    case 'top_left':
      return { x: left, y: String(pad + 48) }
    case 'top_right':
      return { x: right, y: String(pad + 48) }
    case 'bottom_left':
      return { x: left, y: `H-h-${captionClear}` }
    case 'bottom_right':
      return { x: right, y: `H-h-${captionClear}` }
    default:
      return { x: right, y: String(pad + 48) }
  }
}

/**
 * Build an ordered overlay plan for the render path (catalog lookup + XY + width).
 * @param {unknown} raw
 * @returns {Array<{
 *   id: string,
 *   category: EofStickerCategory,
 *   asset: string,
 *   widthPx: number,
 *   position: EofStickerPositionId,
 *   x: string,
 *   y: string,
 * }>}
 */
export function planEofStickerOverlays(raw) {
  const { items } = normalizeEofStickers(raw)
  /** @type {ReturnType<typeof planEofStickerOverlays>} */
  const plan = []
  for (const item of items) {
    const catalog = getEofStickerById(item.id)
    if (!catalog?.asset) continue
    const { x, y } = stickerOverlayXY(item.position)
    plan.push({
      id: catalog.id,
      category: catalog.category,
      asset: catalog.asset,
      widthPx: Math.max(48, Math.min(520, Number(catalog.widthPx) || 160)),
      position: item.position,
      x,
      y,
    })
  }
  return plan
}
