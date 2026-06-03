/** Layout helpers for the visual page editor (center in panel + align vs siblings). */

export function contentBoundsFor(el) {
  if (!(el instanceof Element)) return null
  const ring = el.firstElementChild
  if (!(ring instanceof Element)) return el.getBoundingClientRect()

  const parts = Array.from(ring.children).filter(
    (child) => child instanceof Element && !child.hasAttribute('data-editor-ui'),
  )
  if (!parts.length) return el.getBoundingClientRect()

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const part of parts) {
    const r = part.getBoundingClientRect()
    left = Math.min(left, r.left)
    top = Math.min(top, r.top)
    right = Math.max(right, r.right)
    bottom = Math.max(bottom, r.bottom)
  }
  if (!Number.isFinite(left)) return el.getBoundingClientRect()
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  }
}

/** Draggable blocks in the same align group, excluding nested drag wrappers. */
export function dragNodesInAlignGroup(el) {
  if (!(el instanceof Element)) return { nodes: [], index: -1, group: null }
  const group = el.closest('[data-editor-align-group]')
  if (!group) return { nodes: [], index: -1, group: null }

  const all = Array.from(group.querySelectorAll('[data-editor-drag]'))
  const nodes = all.filter((node) => {
    let parent = node.parentElement
    while (parent && parent !== group) {
      if (parent.hasAttribute('data-editor-drag') && all.includes(parent)) return false
      parent = parent.parentElement
    }
    return true
  })

  nodes.sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    return ra.top - rb.top || ra.left - rb.left
  })

  return { nodes, index: nodes.indexOf(el), group }
}

export function centerRootFor(el, axis = 'x') {
  if (!(el instanceof Element)) return null
  if (axis === 'y') {
    return (
      el.parentElement?.closest('[data-editor-center-y-root]') ||
      el.parentElement?.closest('[data-editor-center-root]') ||
      el.parentElement?.closest('[data-editor-align-group]') ||
      el.parentElement
    )
  }
  return (
    el.parentElement?.closest('[data-editor-center-root]') ||
    el.parentElement?.closest('[data-editor-align-group]') ||
    el.parentElement
  )
}

export function centerInRoot(content, root, offsetX, offsetY, axis = 'both') {
  if (!content || !root) return { x: offsetX, y: offsetY }
  const r = root.getBoundingClientRect()
  const contentCenterX = content.left + content.width / 2
  const contentCenterY = content.top + content.height / 2
  const rootCenterX = r.left + r.width / 2
  const rootCenterY = r.top + r.height / 2

  let x = offsetX
  let y = offsetY
  if (axis === 'x' || axis === 'both') {
    x = Math.round(offsetX + (rootCenterX - contentCenterX))
  }
  if (axis === 'y' || axis === 'both') {
    y = Math.round(offsetY + (rootCenterY - contentCenterY))
  }
  return { x, y }
}

/** Midpoint between previous and next sibling blocks (or match single neighbor). */
export function alignBetweenSiblings(el, content, offsetX, offsetY, axis = 'both') {
  const { nodes, index } = dragNodesInAlignGroup(el)
  const prev = index > 0 ? nodes[index - 1] : null
  const next = index >= 0 && index < nodes.length - 1 ? nodes[index + 1] : null

  let x = offsetX
  let y = offsetY
  const contentCenterX = content.left + content.width / 2
  const contentCenterY = content.top + content.height / 2

  if (axis === 'x' || axis === 'both') {
    if (prev && next) {
      const pb = contentBoundsFor(prev)
      const nb = contentBoundsFor(next)
      if (pb && nb) {
        const targetX = (pb.left + pb.width / 2 + (nb.left + nb.width / 2)) / 2
        x = Math.round(offsetX + (targetX - contentCenterX))
      }
    } else {
      const neighbor = prev || next
      const nb = neighbor ? contentBoundsFor(neighbor) : null
      if (nb) {
        const targetX = nb.left + nb.width / 2
        x = Math.round(offsetX + (targetX - contentCenterX))
      }
    }
  }

  if (axis === 'y' || axis === 'both') {
    if (prev && next) {
      const pb = contentBoundsFor(prev)
      const nb = contentBoundsFor(next)
      if (pb && nb) {
        const targetY = (pb.bottom + nb.top) / 2
        y = Math.round(offsetY + (targetY - contentCenterY))
      }
    } else if (prev) {
      const pb = contentBoundsFor(prev)
      if (pb) {
        const targetY = pb.top + pb.height / 2
        y = Math.round(offsetY + (targetY - contentCenterY))
      }
    } else if (next) {
      const nb = contentBoundsFor(next)
      if (nb) {
        const targetY = nb.top + nb.height / 2
        y = Math.round(offsetY + (targetY - contentCenterY))
      }
    }
  }

  return { x, y }
}

/** Match horizontal center with the average of all sibling blocks in the group. */
export function alignWithSiblingsCenterX(el, content, offsetX, offsetY) {
  const { nodes, index } = dragNodesInAlignGroup(el)
  const others = nodes.filter((_, i) => i !== index)
  if (!others.length) return { x: offsetX, y: offsetY }

  let sum = 0
  let count = 0
  for (const node of others) {
    const b = contentBoundsFor(node)
    if (!b) continue
    sum += b.left + b.width / 2
    count += 1
  }
  if (!count) return { x: offsetX, y: offsetY }

  const targetX = sum / count
  const contentCenterX = content.left + content.width / 2
  return {
    x: Math.round(offsetX + (targetX - contentCenterX)),
    y: offsetY,
  }
}
