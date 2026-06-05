/** In-memory cache so route changes do not flash loading states and reflow the homepage hero. */

const competitionBySlug = new Map()
let featuredHomepageCompetition = undefined
let homepageLayoutCache = null

export function getCachedCompetition(slug) {
  return competitionBySlug.get(slug)
}

export function setCachedCompetition(slug, competition) {
  competitionBySlug.set(slug, competition ?? null)
}

export function clearPublicCompetitionCaches() {
  competitionBySlug.clear()
  featuredHomepageCompetition = undefined
}

export function getCachedFeaturedHomepageCompetition() {
  return featuredHomepageCompetition
}

export function setCachedFeaturedHomepageCompetition(competition) {
  featuredHomepageCompetition = competition ?? null
}

export function getCachedHomepageLayout() {
  return homepageLayoutCache
}

export function setCachedHomepageLayout(layout) {
  homepageLayoutCache = layout
}

let sitePagesCache = null

export function getCachedSitePages() {
  return sitePagesCache
}

export function setCachedSitePages(pages) {
  sitePagesCache = pages
}

/** Call after admin saves layout so the public site refetches on next visit. */
export function clearPublicLayoutCaches() {
  homepageLayoutCache = null
  sitePagesCache = null
  featuredHomepageCompetition = undefined
}

/** Notify open tabs to reload competition dates and layout from the API. */
export function notifyCompetitionUpdated(slug) {
  clearPublicCompetitionCaches()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ss-competition-updated', { detail: { slug } }))
  }
}

/** Notify open tabs to reload layout from the API (homepage, site shell, etc.). */
export function notifyLayoutUpdated(pageId) {
  clearPublicLayoutCaches()
  clearPublicCompetitionCaches()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ss-layout-updated', { detail: { pageId } }))
  }
}

const LAYOUT_PAGE_GROUPS = {
  homepage: ['homepage'],
  site: ['site'],
  competitions: ['competitions'],
  faq: ['faq'],
  contact: ['contact'],
  shirt_giveaway: ['shirt_giveaway'],
  email_layout: ['email_layout'],
}

export function layoutUpdateAffectsPage(savedPageId, listenerPageId) {
  if (!savedPageId || !listenerPageId) return false
  if (savedPageId === listenerPageId) return true
  const group = LAYOUT_PAGE_GROUPS[savedPageId]
  return group ? group.includes(listenerPageId) : false
}
