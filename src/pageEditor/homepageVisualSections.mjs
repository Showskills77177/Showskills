import { HOMEPAGE_BLOCK_IDS } from '../../shared/homepageLayout.mjs'

const HERO_BLOCK_IDS = new Set([
  'promo_strip',
  'hero_intro',
  'hero_prizes',
  'hero_details',
  'ticket_bundles',
])

export const HOME_VISUAL_SECTIONS = [
  { id: 'hero', label: 'Hero section' },
  { id: 'competitions_hub', label: 'Competitions hub' },
  { id: 'winners_panel', label: 'Winners panel' },
]

export function getHomeVisualSections(blockOrder) {
  const order = (blockOrder || HOMEPAGE_BLOCK_IDS).filter((id) => HOMEPAGE_BLOCK_IDS.includes(id))
  const heroBlockIds = order.filter((id) => HERO_BLOCK_IDS.has(id))
  const sections = []
  let heroAdded = false

  for (const id of order) {
    if (HERO_BLOCK_IDS.has(id)) {
      if (!heroAdded) {
        sections.push({ id: 'hero', label: 'Hero section', blockIds: heroBlockIds.length ? heroBlockIds : [...HERO_BLOCK_IDS] })
        heroAdded = true
      }
    } else if (id === 'competitions_hub') {
      sections.push({ id: 'competitions_hub', label: 'Competitions hub', blockIds: ['competitions_hub'] })
    } else if (id === 'winners_panel') {
      sections.push({ id: 'winners_panel', label: 'Winners panel', blockIds: ['winners_panel'] })
    }
  }

  if (!heroAdded) {
    sections.unshift({ id: 'hero', label: 'Hero section', blockIds: [...HERO_BLOCK_IDS] })
  }

  return sections
}

export function reorderHomeVisualSections(blockOrder, fromSectionId, toSectionId, position = 'before') {
  if (!fromSectionId || !toSectionId || fromSectionId === toSectionId) return blockOrder
  const sections = getHomeVisualSections(blockOrder)
  const fromIdx = sections.findIndex((s) => s.id === fromSectionId)
  const toIdx = sections.findIndex((s) => s.id === toSectionId)
  if (fromIdx < 0 || toIdx < 0) return blockOrder
  const next = [...sections]
  const [moved] = next.splice(fromIdx, 1)
  let insertAt = toIdx
  if (position === 'after') insertAt = toIdx + 1
  if (fromIdx < insertAt) insertAt -= 1
  next.splice(insertAt, 0, moved)
  return next.flatMap((s) => s.blockIds)
}

/** Reorder a single homepage block within blockOrder (hero sub-blocks + page sections). */
export function reorderHomepageBlocks(blockOrder, fromBlockId, toBlockId, position = 'before') {
  if (!fromBlockId || !toBlockId || fromBlockId === toBlockId) return blockOrder
  const ids = (blockOrder || HOMEPAGE_BLOCK_IDS).filter((id) => HOMEPAGE_BLOCK_IDS.includes(id))
  const from = ids.indexOf(fromBlockId)
  const to = ids.indexOf(toBlockId)
  if (from < 0 || to < 0) return blockOrder
  const next = [...ids]
  next.splice(from, 1)
  let insertAt = to
  if (position === 'after') insertAt = to + 1
  if (from < insertAt) insertAt -= 1
  next.splice(insertAt, 0, fromBlockId)
  return next
}

export function homeVisualSectionForBlock(blockId) {
  if (HERO_BLOCK_IDS.has(blockId)) return 'hero'
  if (blockId === 'competitions_hub' || blockId === 'winners_panel') return blockId
  return null
}

export function isHomeVisualSectionId(id) {
  return id === 'hero' || id === 'competitions_hub' || id === 'winners_panel'
}
