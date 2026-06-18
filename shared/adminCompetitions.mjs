/** Admin competition registry — main prize draws and separate giveaways. */

import { DRAW_COMPETITION_SLUG, DRAW_COMPETITION_LABEL } from './competitionPeriods.mjs'
import { IPHONE_17_PRO_COMPETITION_LABEL, IPHONE_17_PRO_COMPETITION_SLUG } from './iphone17ProCompetition.mjs'
import { COMPETITION_SHIRT_GIVEAWAY } from './freeEntryLimits.mjs'

export const MJ_COMPETITION_SLUG = 'michael_jackson_album'
export const MJ_COMPETITION_LABEL = 'Michael Jackson Signed Album'

/** Grand-prize skill competitions (ticket bundles + periods + draw). */
export const MAIN_DRAW_COMPETITIONS = [
  { slug: DRAW_COMPETITION_SLUG, label: DRAW_COMPETITION_LABEL },
  { slug: MJ_COMPETITION_SLUG, label: MJ_COMPETITION_LABEL },
  {
    slug: IPHONE_17_PRO_COMPETITION_SLUG,
    label: IPHONE_17_PRO_COMPETITION_LABEL,
  },
]

/** Side promotions (shirt sign-ups, consolation rows) — not Legacy draw pool. */
export const GIVEAWAY_COMPETITIONS = [
  { slug: COMPETITION_SHIRT_GIVEAWAY, label: 'Free Ronaldo shirt giveaway' },
]

export const ALL_ADMIN_COMPETITIONS = [...MAIN_DRAW_COMPETITIONS, ...GIVEAWAY_COMPETITIONS]

const MAIN_DRAW_BY_SLUG = new Map(MAIN_DRAW_COMPETITIONS.map((c) => [c.slug, c]))
const GIVEAWAY_BY_SLUG = new Map(GIVEAWAY_COMPETITIONS.map((c) => [c.slug, c]))
const ALL_BY_SLUG = new Map(ALL_ADMIN_COMPETITIONS.map((c) => [c.slug, c]))

export function isValidCompetitionSlug(slug) {
  return /^[a-z][a-z0-9_]{0,79}$/.test(String(slug || '').trim())
}

export function isMainDrawCompetitionSlug(slug) {
  return MAIN_DRAW_BY_SLUG.has(String(slug || '').trim())
}

export function isGiveawayCompetitionSlug(slug) {
  return GIVEAWAY_BY_SLUG.has(String(slug || '').trim())
}

export function getMainDrawCompetitionLabel(slug) {
  return MAIN_DRAW_BY_SLUG.get(String(slug || '').trim())?.label || slug || 'Competition'
}

export function getGiveawayCompetitionLabel(slug) {
  return GIVEAWAY_BY_SLUG.get(String(slug || '').trim())?.label || slug || 'Giveaway'
}

export function getAdminCompetitionLabel(slug) {
  return ALL_BY_SLUG.get(String(slug || '').trim())?.label || slug || 'Competition'
}

/** @param {URLSearchParams|URL|string} source */
export function parseAdminCompetitionFilter(source, { kind = 'mainDraw', param = 'competition' } = {}) {
  let raw = ''
  if (source instanceof URLSearchParams) {
    raw = (source.get(param) || '').trim()
  } else if (source instanceof URL) {
    raw = (source.searchParams.get(param) || '').trim()
  } else if (typeof source === 'string') {
    try {
      raw = new URL(source, 'http://local').searchParams.get(param)?.trim() || ''
    } catch {
      raw = ''
    }
  }
  if (!raw) return null

  if (kind === 'mainDraw') {
    return isValidCompetitionSlug(raw) ? raw : null
  }
  if (kind === 'giveaway') {
    return isGiveawayCompetitionSlug(raw) ? raw : null
  }
  if (kind === 'any') {
    if (isGiveawayCompetitionSlug(raw)) return raw
    if (isValidCompetitionSlug(raw)) return raw
    return ALL_BY_SLUG.has(raw) ? raw : null
  }
  return null
}

export function defaultMainDrawCompetitionSlug() {
  return DRAW_COMPETITION_SLUG
}

export function defaultGiveawayCompetitionSlug() {
  return COMPETITION_SHIRT_GIVEAWAY
}
