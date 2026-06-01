/** Drag offsets stored in page layout JSON (pixels from default position). */

export function defaultOffset(scale = 1) {
  return { x: 0, y: 0, scale }
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
