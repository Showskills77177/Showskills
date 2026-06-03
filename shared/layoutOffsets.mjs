/** Drag offsets stored in page layout JSON (pixels from default position). */

export const EDITOR_SNAP_GRID_PX = 8

export function defaultOffset(scale = 1) {
  return { x: 0, y: 0, scale }
}

export function snapToGrid(value, grid = EDITOR_SNAP_GRID_PX, enabled = true) {
  const n = Number(value) || 0
  if (!enabled || !grid) return Math.round(n)
  return Math.round(n / grid) * grid
}

export function snapOffset(offset, { grid = EDITOR_SNAP_GRID_PX, snap = true } = {}) {
  if (!offset) return { x: 0, y: 0, scale: 1 }
  return {
    x: snapToGrid(offset.x, grid, snap),
    y: snapToGrid(offset.y, grid, snap),
    scale: Number(offset.scale) || 1,
  }
}

export function mergeOffsets(defaults = {}, input) {
  if (!input || typeof input !== 'object') return { ...defaults }
  const out = { ...defaults }
  for (const [key, val] of Object.entries(input)) {
    if (!val || typeof val !== 'object') continue
    const base = defaults[key] || defaultOffset()
    out[key] = {
      x: Number(val.x) || 0,
      y: Number(val.y) || 0,
      scale: Number(val.scale) || base.scale || 1,
    }
  }
  return out
}

/**
 * @param {object} offset
 * @param {{ scale?: number, transformOrigin?: string, widthOnly?: boolean }} opts
 */
export function offsetStyle(offset, { scale: fallbackScale = 1, transformOrigin = 'center center', widthOnly = false } = {}) {
  if (!offset) return undefined
  const x = Number(offset.x) || 0
  const y = Number(offset.y) || 0
  const scale = Number(offset.scale) || fallbackScale
  if (x === 0 && y === 0 && scale === fallbackScale) return undefined
  if (widthOnly) {
    return {
      transform: `translate(${x}px, ${y}px) scaleX(${scale})`,
      transformOrigin,
    }
  }
  return {
    transform: `translate(${x}px, ${y}px) scale(${scale})`,
    transformOrigin,
  }
}

/**
 * CSS for saved offsets on the public site (mirrors editor persistence).
 * Returns null when no transform is needed.
 */
export function liveOffsetStyle(pos, opts = {}) {
  if (!pos) return null
  const {
    cssScaleOnly = false,
    transformOrigin = cssScaleOnly ? 'center top' : 'center center',
    widthOnly = true,
    scale: fallbackScale = 1,
  } = opts

  if (cssScaleOnly) {
    const x = Number(pos.x) || 0
    const y = Number(pos.y) || 0
    if (!x && !y) return null
    return {
      transform: `translate(${x}px, ${y}px)`,
      transformOrigin,
    }
  }

  return offsetStyle(pos, {
    scale: Number(pos.scale) || fallbackScale,
    transformOrigin,
    widthOnly,
  })
}
