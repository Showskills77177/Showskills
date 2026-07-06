/** Editable public site shell + inner page copy (stored in DB, merged with code defaults). */

import { defaultOffset, mergeOffsets, offsetStyle } from './layoutOffsets.mjs'
import { FAQ_PAGE_TITLE, FAQ_PAGE_SUBTITLE } from './faqContent.mjs'
import { DEFAULT_SOCIAL_LINKS, mergeSocialLinks } from './socialLinks.mjs'
import { EMAIL_LAYOUT_PAGE_ID } from './emailLayout.mjs'
import { SHIRT_GIVEAWAY_SEASON, refreshShirtGiveawaySeasonInText } from './shirtGiveaway.mjs'
import { WORLD_CUP_BALL_GIVEAWAY_LABEL } from './worldCupBallGiveaway.mjs'
import { SITE_DESIGN_THEMES, normalizeSiteDesignTheme } from './siteDesignThemes.mjs'

export { EMAIL_LAYOUT_PAGE_ID }

export const SITE_SHELL_ID = 'site'
export const COMPETITIONS_PAGE_ID = 'competitions'
export const FAQ_PAGE_ID = 'faq'
export const CONTACT_PAGE_ID = 'contact'
export const SHIRT_GIVEAWAY_PAGE_ID = 'shirt_giveaway'

export const EDITABLE_PAGE_IDS = [
  SITE_SHELL_ID,
  COMPETITIONS_PAGE_ID,
  FAQ_PAGE_ID,
  CONTACT_PAGE_ID,
  SHIRT_GIVEAWAY_PAGE_ID,
  EMAIL_LAYOUT_PAGE_ID,
]

export const PAGE_EDITOR_LABELS = {
  [SITE_SHELL_ID]: 'Site header & footer',
  homepage: 'Homepage',
  [COMPETITIONS_PAGE_ID]: 'Competitions',
  [FAQ_PAGE_ID]: 'FAQ',
  [CONTACT_PAGE_ID]: 'Contact',
  [SHIRT_GIVEAWAY_PAGE_ID]: 'Shirt giveaway',
  [EMAIL_LAYOUT_PAGE_ID]: 'Newsletter emails',
}

export const SITE_PAGE_BACKGROUNDS = {
  default: 'default',
  solid: 'solid',
}

const DEFAULT_NAV = [
  { id: 'home', label: 'Home', path: '/', visible: true, mobile: true },
  { id: 'competitions', label: 'Competitions', path: '/competitions', visible: true, mobile: true },
  { id: 'faq', label: 'FAQ', path: '/faq', visible: true, mobile: true },
  { id: 'terms', label: 'T&C', action: 'terms', visible: true, mobile: true },
]

const DEFAULT_FOOTER_LINKS = {
  competitions: { label: 'Competitions', path: '/competitions', visible: true },
  newsletter: { label: 'Newsletter', path: '/newsletter', visible: true },
  contact: { label: 'Contact', path: '/contact', visible: true },
  faq: { label: 'FAQ', path: '/faq', visible: true },
  terms: { label: 'Full terms & privacy', action: 'terms', visible: true },
  ticketTerms: { label: 'Paid ticket terms', action: 'ticketTerms', visible: true },
}

const DEFAULT_HEADER_OFFSETS = {
  nav: defaultOffset(),
  logo: defaultOffset(),
  tagline: defaultOffset(),
}

const DEFAULT_FOOTER_OFFSETS = {
  logo: defaultOffset(),
  links: defaultOffset(),
  legal: defaultOffset(),
  social: defaultOffset(),
  disclaimer: defaultOffset(),
}

export function defaultSiteShell() {
  return {
    version: 1,
    showHeaderTagline: false,
    pageBackground: SITE_PAGE_BACKGROUNDS.default,
    siteDesignTheme: SITE_DESIGN_THEMES.worldCup2026,
    navOrder: DEFAULT_NAV.map((n) => n.id),
    navItems: Object.fromEntries(DEFAULT_NAV.map((n) => [n.id, { ...n }])),
    headerOffsets: { ...DEFAULT_HEADER_OFFSETS },
    footerOffsets: { ...DEFAULT_FOOTER_OFFSETS },
    footer: {
      visible: true,
      showLogo: true,
      legalNotice: '',
      postalLine: '',
      disclaimer: 'Not a lottery. Not affiliated with any athlete, club, or brand in prize imagery.',
      showTrustpilot: true,
      showSocial: true,
      socialLinks: { ...DEFAULT_SOCIAL_LINKS },
      linkOrder: ['competitions', 'newsletter', 'contact', 'faq', 'terms', 'ticketTerms'],
      links: { ...DEFAULT_FOOTER_LINKS },
    },
  }
}

export function defaultCompetitionsPageLayout() {
  return {
    version: 1,
    title: 'Competitions',
    intro:
      'Paid prize draws and free giveaways on ShowSkills Rewards — same skill-based entry rules, different entry routes.',
    offsets: {
      title: defaultOffset(),
      intro: defaultOffset(),
      links: defaultOffset(),
      paid: defaultOffset(),
      free: defaultOffset(),
      shirtCard: defaultOffset(1.1),
      paidPrimaryCard: defaultOffset(),
    },
    legacyBundleCard: defaultLegacyBundleCardLayout(),
    shirtGiveawayCard: defaultShirtGiveawayCardLayout(),
    sectionOrder: ['paid', 'free'],
    sections: {
      paid: {
        visible: true,
        title: 'Prize draw competitions',
        subtitle:
          'Paid ticket bundles plus free postal and free online entry — including the Signed Legacy Bundle.',
      },
      free: {
        visible: true,
        title: 'Free giveaways',
        subtitle:
          'No ticket purchase — enter online or by post (where offered). Newsletter and social follow required for the shirt giveaway.',
      },
    },
    faqLinkLabel: 'Common questions (FAQ)',
    showFaqLink: true,
    jumpLinkLabel: 'Jump to free giveaways',
    showJumpLink: true,
    emptyFreeMessage: '',
  }
}

export function defaultLegacyBundleCardLayout() {
  return {
    metaFeaturedLabel: '',
    title: '',
    summary: '',
    headlineGapPx: 14,
    enterButtonLabel: '',
    offsets: {
      imagery: defaultOffset(),
      meta: defaultOffset(),
      timer: defaultOffset(),
      title: defaultOffset(),
      summary: defaultOffset(),
      price: defaultOffset(),
      enter: defaultOffset(),
    },
  }
}

const TIMER_SCALE_MIN = 0.75
const TIMER_SCALE_MAX = 1.35

function clampTimerScale(scale) {
  const s = Number(scale) || 1
  return Math.min(TIMER_SCALE_MAX, Math.max(TIMER_SCALE_MIN, Math.round(s * 100) / 100))
}

function clampCardOffsetYs(offsets) {
  const out = { ...offsets }
  for (const key of Object.keys(out)) {
    const o = out[key]
    if (!o || typeof o !== 'object') continue
    const y = Number(o.y) || 0
    if (y < 0) out[key] = { ...o, y: 0 }
  }
  return out
}

export function defaultShirtGiveawayCardLayout() {
  return {
    badgeLabel: '',
    title: '',
    prizeLine: '',
    helperLine: '',
    stepsHeading: '',
    stepLabels: ['', '', '', '', ''],
    stepsLinkLabel: '',
    enterButtonLabel: '',
    prizeImageUrl: '',
    headlineGapPx: 12,
    offsets: {
      imagery: defaultOffset(),
      badge: defaultOffset(),
      title: defaultOffset(),
      prizeLine: defaultOffset(),
      helper: defaultOffset(),
      timer: defaultOffset(),
      steps: defaultOffset(),
      enter: defaultOffset(),
    },
  }
}

function mergeStepLabels(base, input) {
  if (!Array.isArray(input)) return base
  return base.map((fallback, index) =>
    typeof input[index] === 'string' ? input[index] : fallback,
  )
}

export function mergeShirtGiveawayCardLayout(base, input) {
  if (!input || typeof input !== 'object') return base
  const gap = Number(input.headlineGapPx)
  const mergedOffsets = clampCardOffsetYs(mergeOffsets(base.offsets, input.offsets))
  if (mergedOffsets.timer) {
    mergedOffsets.timer = {
      x: Number(mergedOffsets.timer.x) || 0,
      y: Number(mergedOffsets.timer.y) || 0,
      scale: clampTimerScale(mergedOffsets.timer.scale),
    }
  }
  const mergedMobileOffsets = clampCardOffsetYs(mergeOffsets({}, input.mobileOffsets))
  if (mergedMobileOffsets.timer) {
    mergedMobileOffsets.timer = {
      x: Number(mergedMobileOffsets.timer.x) || 0,
      y: Number(mergedMobileOffsets.timer.y) || 0,
      scale: clampTimerScale(mergedMobileOffsets.timer.scale),
    }
  }
  return {
    ...base,
    badgeLabel: typeof input.badgeLabel === 'string' ? input.badgeLabel : base.badgeLabel,
    title: typeof input.title === 'string' ? input.title : base.title,
    prizeLine: typeof input.prizeLine === 'string' ? input.prizeLine : base.prizeLine,
    helperLine: typeof input.helperLine === 'string' ? input.helperLine : base.helperLine,
    stepsHeading: typeof input.stepsHeading === 'string' ? input.stepsHeading : base.stepsHeading,
    stepLabels: mergeStepLabels(base.stepLabels, input.stepLabels),
    stepsLinkLabel: typeof input.stepsLinkLabel === 'string' ? input.stepsLinkLabel : base.stepsLinkLabel,
    enterButtonLabel:
      typeof input.enterButtonLabel === 'string' ? input.enterButtonLabel : base.enterButtonLabel,
    prizeImageUrl: typeof input.prizeImageUrl === 'string' ? input.prizeImageUrl : base.prizeImageUrl,
    headlineGapPx: Number.isFinite(gap) && gap >= 0 ? gap : base.headlineGapPx,
    offsets: clampCardOffsetYs(mergedOffsets),
    mobileOffsets: clampCardOffsetYs(mergedMobileOffsets),
  }
}

export function mergeLegacyBundleCardLayout(base, input) {
  if (!input || typeof input !== 'object') return base
  const gap = Number(input.headlineGapPx)
  const mergedOffsets = mergeOffsets(base.offsets, input.offsets)
  // Migrate old single "headline" panel offset onto text blocks if present.
  const legacyHeadline = input.offsets?.headline
  if (legacyHeadline && typeof legacyHeadline === 'object') {
    for (const key of ['meta', 'timer', 'title', 'summary', 'price']) {
      if (input.offsets?.[key] == null) {
        mergedOffsets[key] = {
          x: Number(legacyHeadline.x) || 0,
          y: Number(legacyHeadline.y) || 0,
          scale:
            key === 'timer'
              ? clampTimerScale(legacyHeadline.scale)
              : Number(legacyHeadline.scale) || 1,
        }
      }
    }
  }
  if (mergedOffsets.timer) {
    mergedOffsets.timer = {
      x: Number(mergedOffsets.timer.x) || 0,
      y: Number(mergedOffsets.timer.y) || 0,
      scale: clampTimerScale(mergedOffsets.timer.scale),
    }
  }
  const mergedMobileOffsets = clampCardOffsetYs(mergeOffsets({}, input.mobileOffsets))
  if (mergedMobileOffsets.timer) {
    mergedMobileOffsets.timer = {
      x: Number(mergedMobileOffsets.timer.x) || 0,
      y: Number(mergedMobileOffsets.timer.y) || 0,
      scale: clampTimerScale(mergedMobileOffsets.timer.scale),
    }
  }
  return {
    ...base,
    metaFeaturedLabel: typeof input.metaFeaturedLabel === 'string' ? input.metaFeaturedLabel : base.metaFeaturedLabel,
    title: typeof input.title === 'string' ? input.title : base.title,
    summary: typeof input.summary === 'string' ? input.summary : base.summary,
    headlineGapPx: Number.isFinite(gap) && gap >= 0 ? gap : base.headlineGapPx,
    enterButtonLabel: typeof input.enterButtonLabel === 'string' ? input.enterButtonLabel : base.enterButtonLabel,
    offsets: clampCardOffsetYs(mergedOffsets),
    mobileOffsets: clampCardOffsetYs(mergedMobileOffsets),
  }
}

export function defaultFaqPageLayout() {
  return {
    version: 1,
    title: FAQ_PAGE_TITLE,
    subtitle: FAQ_PAGE_SUBTITLE,
    showSearch: true,
    showPopular: true,
  }
}

export function defaultContactPageLayout() {
  return {
    version: 1,
    eyebrow: 'Get in touch',
    title: 'Contact us',
    intro:
      'Questions about the Signed Legacy Bundle, paid tickets, or postal entry? Check our FAQ first, or send a message below — we will reply to the email you provide.',
    showEmailCard: true,
    showPostalCard: true,
  }
}

export function defaultShirtGiveawayPageLayout() {
  return {
    version: 1,
    badge: 'Free giveaway · Not the paid bundle',
    title: 'Ronaldo shirt giveaway',
    intro:
      `Separate from the paid Signed Legacy Bundle: enter free online to win the signed ${SHIRT_GIVEAWAY_SEASON} Manchester United home shirt shown below. Answer the skill question, enter your details, subscribe to our newsletter, follow us on social media, and submit the form — no payment or video upload.`,
    ctaButtonLabel: 'Open free giveaway form',
    howToTitle: 'How to qualify',
    prizeImageRef: null,
    prizeImageUrl: null,
  }
}

export function defaultPageLayout(pageId) {
  switch (pageId) {
    case SITE_SHELL_ID:
      return defaultSiteShell()
    case COMPETITIONS_PAGE_ID:
      return defaultCompetitionsPageLayout()
    case FAQ_PAGE_ID:
      return defaultFaqPageLayout()
    case CONTACT_PAGE_ID:
      return defaultContactPageLayout()
    case SHIRT_GIVEAWAY_PAGE_ID:
      return defaultShirtGiveawayPageLayout()
    default:
      return null
  }
}

function mergeNavItems(base, input) {
  const items = { ...base.navItems }
  if (input?.navItems && typeof input.navItems === 'object') {
    for (const [id, patch] of Object.entries(input.navItems)) {
      if (items[id]) items[id] = { ...items[id], ...patch }
    }
  }
  const order = Array.isArray(input?.navOrder)
    ? input.navOrder.filter((id) => items[id])
    : base.navOrder
  return { navItems: items, navOrder: order.length ? order : base.navOrder }
}

export function mergeSiteShell(input) {
  const base = defaultSiteShell()
  if (!input || typeof input !== 'object') return base
  const nav = mergeNavItems(base, input)
  const footerBase = base.footer
  const footerIn = input.footer && typeof input.footer === 'object' ? input.footer : {}
  return {
    ...base,
    ...input,
    headerTagline: typeof input.headerTagline === 'string' ? input.headerTagline : base.headerTagline,
    showHeaderTagline: input.showHeaderTagline !== false,
    pageBackground:
      input.pageBackground === SITE_PAGE_BACKGROUNDS.solid
        ? SITE_PAGE_BACKGROUNDS.solid
        : SITE_PAGE_BACKGROUNDS.default,
    siteDesignTheme:
      typeof input.siteDesignTheme === 'string'
        ? normalizeSiteDesignTheme(input.siteDesignTheme)
        : base.siteDesignTheme,
    navItems: nav.navItems,
    navOrder: nav.navOrder,
    headerOffsets: mergeOffsets(base.headerOffsets, input.headerOffsets),
    footerOffsets: mergeOffsets(base.footerOffsets, input.footerOffsets),
    footer: {
      ...footerBase,
      ...footerIn,
      showSocial: footerIn.showSocial !== false,
      socialLinks: mergeSocialLinks({
        ...footerBase.socialLinks,
        ...(footerIn.socialLinks && typeof footerIn.socialLinks === 'object' ? footerIn.socialLinks : {}),
      }),
      links: {
        ...footerBase.links,
        ...(footerIn.links && typeof footerIn.links === 'object' ? footerIn.links : {}),
      },
      linkOrder: Array.isArray(footerIn.linkOrder)
        ? footerIn.linkOrder.filter((id) => footerBase.links[id] || footerIn.links?.[id])
        : footerBase.linkOrder,
    },
  }
}

export function mergeCompetitionsPageLayout(input) {
  const base = defaultCompetitionsPageLayout()
  if (!input || typeof input !== 'object') return base
  const sectionsIn = input.sections && typeof input.sections === 'object' ? input.sections : {}
  return {
    ...base,
    ...input,
    title: typeof input.title === 'string' ? input.title : base.title,
    intro: typeof input.intro === 'string' ? input.intro : base.intro,
    faqLinkLabel: typeof input.faqLinkLabel === 'string' ? input.faqLinkLabel : base.faqLinkLabel,
    jumpLinkLabel: typeof input.jumpLinkLabel === 'string' ? input.jumpLinkLabel : base.jumpLinkLabel,
    showFaqLink: input.showFaqLink !== false,
    showJumpLink: input.showJumpLink !== false,
    emptyFreeMessage:
      typeof input.emptyFreeMessage === 'string' ? input.emptyFreeMessage : base.emptyFreeMessage,
    offsets: mergeOffsets(base.offsets, input.offsets),
    mobileOffsets: mergeOffsets({}, input.mobileOffsets),
    legacyBundleCard: mergeLegacyBundleCardLayout(base.legacyBundleCard, input.legacyBundleCard),
    shirtGiveawayCard: mergeShirtGiveawayCardLayout(base.shirtGiveawayCard, input.shirtGiveawayCard),
    sectionOrder: Array.isArray(input.sectionOrder)
      ? [
          ...input.sectionOrder.filter((id) => base.sections[id]),
          ...Object.keys(base.sections).filter((id) => !input.sectionOrder.includes(id)),
        ]
      : base.sectionOrder,
    sections: {
      paid: { ...base.sections.paid, ...(sectionsIn.paid || {}) },
      free: { ...base.sections.free, ...(sectionsIn.free || {}) },
    },
  }
}

export function mergeFaqPageLayout(input) {
  const base = defaultFaqPageLayout()
  if (!input || typeof input !== 'object') return base
  return {
    ...base,
    ...input,
    showSearch: input.showSearch !== false,
    showPopular: input.showPopular !== false,
  }
}

export function mergeContactPageLayout(input) {
  const base = defaultContactPageLayout()
  if (!input || typeof input !== 'object') return base
  return {
    ...base,
    ...input,
    showEmailCard: input.showEmailCard !== false,
    showPostalCard: input.showPostalCard !== false,
  }
}

export function mergeShirtGiveawayPageLayout(input) {
  const base = defaultShirtGiveawayPageLayout()
  if (!input || typeof input !== 'object') return base
  const intro =
    input.intro != null ? refreshShirtGiveawaySeasonInText(String(input.intro)) : base.intro
  return {
    ...base,
    ...input,
    intro,
    prizeImageRef: input.prizeImageRef || null,
    prizeImageUrl: input.prizeImageUrl || null,
  }
}

export function mergePageLayout(pageId, input) {
  switch (pageId) {
    case SITE_SHELL_ID:
      return mergeSiteShell(input)
    case COMPETITIONS_PAGE_ID:
      return mergeCompetitionsPageLayout(input)
    case FAQ_PAGE_ID:
      return mergeFaqPageLayout(input)
    case CONTACT_PAGE_ID:
      return mergeContactPageLayout(input)
    case SHIRT_GIVEAWAY_PAGE_ID:
      return mergeShirtGiveawayPageLayout(input)
    default:
      return null
  }
}

/** Human labels for homepage blocks (Page Editor). */
export const HOMEPAGE_BLOCK_LABELS = {
  promo_strip: 'Live promotion badge',
  hero_intro: 'Hero copy & brand title',
  hero_prizes: 'Prize images & enter button',
  hero_details: 'Bundle details card',
  ticket_bundles: 'Ticket bundle prices',
  iphone_17_pro_panel: 'iPhone 17 Pro or Cash panel',
  world_cup_ball_panel: `${WORLD_CUP_BALL_GIVEAWAY_LABEL} panel`,
  winners_panel: 'Recent winners',
  competitions_hub: 'Competitions hub (paid + free)',
}

/** Human labels for competitions page blocks (Page Editor). */
export const COMPETITIONS_BLOCK_LABELS = {
  comp_title: 'Page title',
  comp_intro: 'Intro paragraph',
  comp_links: 'Links under intro',
  comp_paid: 'Prize draws column',
  comp_free: 'Free giveaways column',
  comp_shirt: 'Shirt giveaway card',
  comp_paid_card: 'Signed Legacy Bundle card',
  comp_paid_card_image: 'Bundle prize images',
  comp_paid_card_meta: 'Meta labels',
  comp_paid_card_timer: 'Countdown timer',
  comp_paid_card_title: 'Competition title',
  comp_paid_card_summary: 'Summary text',
  comp_paid_card_price: 'Price badge',
  comp_paid_card_enter: 'Enter button',
  comp_shirt_card_image: 'Shirt prize image',
  comp_shirt_card_badge: 'Free giveaway badge',
  comp_shirt_card_title: 'Giveaway title',
  comp_shirt_card_prize: 'Prize line',
  comp_shirt_card_helper: 'Helper line',
  comp_shirt_card_timer: 'Countdown timer',
  comp_shirt_card_steps: 'Entry steps box',
  comp_shirt_card_enter: 'Enter button',
}
