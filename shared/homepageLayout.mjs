/** Editable homepage layout — stored in DB, applied on the public home page. */

import { defaultOffset, mergeOffsets } from './layoutOffsets.mjs'
import { mergeSocialLinks } from './socialLinks.mjs'

export const HOMEPAGE_BLOCK_IDS = [
  'promo_strip',
  'hero_intro',
  'hero_prizes',
  'hero_details',
  'ticket_bundles',
  'competitions_hub',
  'winners_panel',
]

export const HOMEPAGE_HERO_BACKGROUNDS = {
  kickups: 'kickups-hero-bg',
  competitions: 'competitions-page-bg',
}

const DEFAULT_INTRO_OFFSETS = {
  brandTitle: defaultOffset(),
  headline: defaultOffset(),
  helper: defaultOffset(),
  ctaRow: defaultOffset(),
}

const DEFAULT_PRIZES_OFFSETS = {
  studioPanel: defaultOffset(),
  countdown: { x: 0, y: 0, scale: 1 },
  ctaBlurb: defaultOffset(),
  ctaButton: defaultOffset(),
}

const DEFAULT_DETAILS_OFFSETS = { panel: defaultOffset(1.06) }
const DEFAULT_BUNDLES_OFFSETS = { panel: defaultOffset() }

export function defaultHomepageLayout() {
  return {
    version: 1,
    heroBackground: HOMEPAGE_HERO_BACKGROUNDS.kickups,
    heroColumnOrder: 'intro-left',
    blockOrder: [...HOMEPAGE_BLOCK_IDS],
    blocks: {
      promo_strip: {
        visible: true,
        livePromotionLabel: 'Live promotion',
        offsets: { badge: defaultOffset() },
      },
      hero_intro: {
        visible: true,
        brandTitle: 'ShowSkills Rewards',
        headline:
          'Signed Legacy Bundle — pay online or enter by post, then answer 3 hard skill questions for the full kit draw. One attempt per entry — all correct to qualify.',
        highlightPhrase: '3 hard skill questions',
        consolationCopy:
          'Get the questions wrong? You automatically receive 2 entries into the separate Free Ronaldo Shirt Giveaway (consolation prize). Tickets are not refunded.',
        helperCopy: 'Enter the Signed Legacy Bundle draw below or visit Competitions for more ways to play.',
        prizeLineupLabel: 'Prize lineup',
        shirtLinkLabel: 'Free shirt giveaway',
        offsets: { ...DEFAULT_INTRO_OFFSETS },
      },
      hero_prizes: {
        visible: true,
        ctaBlurb:
          'Buy tickets online or enter by post — same prize. Three Ronaldo questions, one attempt each. All correct to qualify for the main draw. Wrong answers? 2 automatic shirt giveaway entries (consolation).',
        ctaButtonLabel: 'Enter Bundle Draw',
        prizeImages: {
          poster: { x: 0, y: 0, scale: 1 },
          phone: { x: 0, y: 0, scale: 1.375 },
          case: { x: 0, y: 0, scale: 1 },
        },
        offsets: { ...DEFAULT_PRIZES_OFFSETS },
      },
      hero_details: {
        visible: true,
        title: 'Signed Legacy Bundle details',
        offsets: { ...DEFAULT_DETAILS_OFFSETS },
      },
      ticket_bundles: {
        visible: true,
        offsets: { ...DEFAULT_BUNDLES_OFFSETS },
      },
      competitions_hub: {
        visible: false,
        title: 'Competitions',
        subtitle:
          'Two ways to play on ShowSkills Rewards — paid prize draws with ticket bundles, and separate free giveaways.',
        paidTitle: 'Main paid competitions',
        paidSubtitle:
          'Signed Legacy Bundle and other main draws — buy tickets or enter by post, then answer three skill questions.',
        freeTitle: 'Free giveaways',
        freeSubtitle:
          'No payment — qualify with a simple question and enter the shirt draw and other free promotions.',
        separatorLabel: 'Free giveaways',
      },
      winners_panel: {
        visible: false,
        title: 'Recent winners',
        subtitle: 'Congratulations to our latest prize draw winners on ShowSkills Rewards.',
        maxItems: 6,
        manualWinners: [],
      },
    },
    socialLinks: mergeSocialLinks(null),
  }
}

export function mergePrizeImages(input) {
  const base = defaultHomepageLayout().blocks.hero_prizes.prizeImages
  if (!input || typeof input !== 'object') return base
  const out = { ...base }
  for (const key of ['poster', 'phone', 'case']) {
    if (input[key] && typeof input[key] === 'object') {
      out[key] = {
        x: Number(input[key].x) || 0,
        y: Number(input[key].y) || 0,
        scale: Number(input[key].scale) || base[key].scale,
      }
    }
  }
  if (out.phone && Math.abs(out.phone.scale - 1.25) < 0.01) {
    out.phone.scale = base.phone.scale
  }
  return out
}

/** Prevent saved editor nudges from pulling hero CTAs over the prize studio. */
function sanitizeHeroPrizesOffsets(offsets) {
  const o = mergeOffsets(defaultHomepageLayout().blocks.hero_prizes.offsets, offsets)
  const clamp = (key, { maxAbsX = 48, maxY = 36, minY = 0 } = {}) => {
    if (!o[key]) return
    const x = Number(o[key].x) || 0
    const y = Number(o[key].y) || 0
    o[key] = {
      ...o[key],
      x: Math.max(-maxAbsX, Math.min(maxAbsX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
      scale: Math.max(0.85, Math.min(1.25, Number(o[key].scale) || 1)),
    }
  }
  clamp('countdown', { maxAbsX: 40, maxY: 24, minY: 0 })
  clamp('ctaBlurb', { maxAbsX: 40, maxY: 20, minY: 0 })
  clamp('ctaButton', { maxAbsX: 32, maxY: 16, minY: 0 })
  clamp('studioPanel', { maxAbsX: 24, maxY: 24, minY: -8 })
  return o
}

function sanitizeHeroDetailsOffsets(offsets) {
  const o = mergeOffsets(defaultHomepageLayout().blocks.hero_details.offsets, offsets)
  if (o.panel) {
    const scale = Math.max(0.9, Math.min(1.2, Number(o.panel.scale) || 1))
    o.panel = {
      ...o.panel,
      x: Math.max(-20, Math.min(20, Number(o.panel.x) || 0)),
      y: Math.max(-12, Math.min(12, Number(o.panel.y) || 0)),
      scale,
    }
  }
  return o
}

function mergeBlock(blockId, merged, base) {
  const b = base.blocks[blockId]
  const m = merged[blockId] || {}
  const next = { ...b, ...m }
  if (blockId === 'hero_prizes') {
    next.prizeImages = mergePrizeImages(m.prizeImages)
    next.offsets = sanitizeHeroPrizesOffsets(m.offsets)
    if (m.mobileOffsets) next.mobileOffsets = sanitizeHeroPrizesOffsets(m.mobileOffsets)
  } else if (blockId === 'hero_details') {
    next.offsets = sanitizeHeroDetailsOffsets(m.offsets)
    if (m.mobileOffsets) next.mobileOffsets = sanitizeHeroDetailsOffsets(m.mobileOffsets)
  } else if (blockId === 'hero_intro') {
    next.offsets = mergeOffsets(b.offsets, m.offsets)
    if (next.offsets.countdown) delete next.offsets.countdown
    next.mobileOffsets = mergeOffsets({}, m.mobileOffsets)
  } else if (b.offsets) {
    next.offsets = mergeOffsets(b.offsets, m.offsets)
    next.mobileOffsets = mergeOffsets({}, m.mobileOffsets)
  }
  if (blockId === 'competitions_hub' || blockId === 'winners_panel') {
    next.visible = m.visible === true
  }
  return next
}

export function mergeHomepageLayout(input) {
  const base = defaultHomepageLayout()
  if (!input || typeof input !== 'object') return base
  const rawBlocks = {
    ...base.blocks,
    ...(input.blocks && typeof input.blocks === 'object' ? input.blocks : {}),
  }
  const mergedBlocks = {}
  for (const id of HOMEPAGE_BLOCK_IDS) {
    mergedBlocks[id] = mergeBlock(id, rawBlocks, base)
  }
  return {
    ...base,
    ...input,
    heroBackground: input.heroBackground || base.heroBackground,
    heroColumnOrder: input.heroColumnOrder === 'prizes-left' ? 'prizes-left' : 'intro-left',
    blockOrder: Array.isArray(input.blockOrder)
      ? [
          ...input.blockOrder.filter((id) => HOMEPAGE_BLOCK_IDS.includes(id)),
          ...HOMEPAGE_BLOCK_IDS.filter((id) => !input.blockOrder.includes(id)),
        ]
      : base.blockOrder,
    blocks: mergedBlocks,
    socialLinks: mergeSocialLinks({
      ...base.socialLinks,
      ...(input.socialLinks && typeof input.socialLinks === 'object' ? input.socialLinks : {}),
    }),
  }
}

/** Sections hidden by default until explicitly enabled in the page editor. */
export const HOMEPAGE_OPT_IN_BLOCK_IDS = new Set(['competitions_hub', 'winners_panel'])

/** Hub and winners only render when explicitly enabled in the editor. */
export function isHomeBlockVisible(block) {
  return block?.visible === true
}

/** Checked state for homepage visibility toggles in the page editor. */
export function homeBlockEditorVisible(block, blockId) {
  if (HOMEPAGE_OPT_IN_BLOCK_IDS.has(blockId)) return block?.visible === true
  return block?.visible !== false
}

export function maskWinnerName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'Winner'
  if (parts.length === 1) return `${parts[0].slice(0, 1).toUpperCase()}${parts[0].slice(1, 2) ? '***' : ''}`
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}
