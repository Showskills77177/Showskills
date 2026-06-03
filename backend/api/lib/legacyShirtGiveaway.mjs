import { COMPETITION_SHIRT_GIVEAWAY } from '../../../shared/freeEntryLimits.mjs'
import { COMPETITION_KIND, COMPETITION_STATUS } from './competitionCatalog.mjs'
import {
  ensureDefaultCompetitionPeriod,
  getCountdownPeriodForDisplay,
  getOpenCompetitionPeriod,
  listCompetitionPeriods,
} from './competitionPeriods.mjs'

export const LEGACY_SHIRT_GIVEAWAY_TITLE = 'Free Ronaldo shirt giveaway'

function mapPeriod(period) {
  if (!period) return null
  return {
    id: period.id,
    title: period.title,
    summary: period.summary,
    entryOpensAt: period.entryOpensAt,
    entryClosesAt: period.entryClosesAt,
    status: period.status,
  }
}

function mapPeriods(periods) {
  return (periods || []).map(mapPeriod)
}

export function isLegacyShirtGiveawaySlug(slug) {
  return String(slug || '').trim() === COMPETITION_SHIRT_GIVEAWAY
}

/** Allows period admin APIs for the legacy shirt slug and catalog competitions. */
export async function assertPeriodCompetitionSlug(slug) {
  const s = String(slug || '').trim()
  if (!s) return { ok: false, error: 'Competition slug required.' }
  if (isLegacyShirtGiveawaySlug(s)) {
    return { ok: true, slug: s, legacyShirt: true }
  }
  const { getCompetitionBySlug, ensureCompetitionCatalogSchema } = await import('./competitionCatalog.mjs')
  await ensureCompetitionCatalogSchema()
  const competition = await getCompetitionBySlug(s)
  if (!competition) return { ok: false, error: 'Competition not found.' }
  return { ok: true, slug: s, competition, legacyShirt: false }
}

export async function ensureLegacyShirtGiveawayPeriods() {
  await ensureDefaultCompetitionPeriod(COMPETITION_SHIRT_GIVEAWAY, { title: LEGACY_SHIRT_GIVEAWAY_TITLE })
}

export async function getLegacyShirtGiveawayAdminDetail() {
  await ensureLegacyShirtGiveawayPeriods()
  const periods = await listCompetitionPeriods(COMPETITION_SHIRT_GIVEAWAY)
  return {
    slug: COMPETITION_SHIRT_GIVEAWAY,
    title: LEGACY_SHIRT_GIVEAWAY_TITLE,
    summary:
      'Legacy free shirt promotion on the site. Entry periods control the public countdown and when sign-ups are accepted.',
    rulesMarkdown: '',
    status: COMPETITION_STATUS.published,
    kind: COMPETITION_KIND.giveaway,
    sortOrder: 0,
    allowPaidEntry: false,
    allowFreeOnline: true,
    allowPostalEntry: false,
    postalCompetitionName: '',
    featuredOnHomepage: false,
    heroImageRef: null,
    gallery: [],
    heroImageUrl: null,
    galleryUrls: [],
    bundles: [],
    skillQuestions: [],
    periods: mapPeriods(periods),
    isLegacyShirtGiveaway: true,
  }
}

export async function getLegacyShirtGiveawayPublicDetail() {
  await ensureLegacyShirtGiveawayPeriods()
  const [openPeriod, countdownPeriod] = await Promise.all([
    getOpenCompetitionPeriod(COMPETITION_SHIRT_GIVEAWAY),
    getCountdownPeriodForDisplay(COMPETITION_SHIRT_GIVEAWAY),
  ])
  return {
    slug: COMPETITION_SHIRT_GIVEAWAY,
    title: 'Ronaldo Shirt Giveaway',
    summary: 'Free signed Ronaldo United shirt giveaway.',
    kind: COMPETITION_KIND.giveaway,
    allowPaidEntry: false,
    allowFreeOnline: true,
    allowPostalEntry: false,
    openPeriod: mapPeriod(openPeriod),
    countdownPeriod: mapPeriod(countdownPeriod),
  }
}
