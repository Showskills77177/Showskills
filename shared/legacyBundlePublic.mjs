import {
  DRAW_COMPETITION_SLUG,
  DRAW_COMPETITION_LABEL,
  RONALDO_LEGACY_BUNDLE_ACTIVE,
} from './competitionPeriods.mjs'
import { legacyEntryMethods } from './competitionEntryMethods.mjs'
import { TICKET_BUNDLES } from './ticketBundles.mjs'

const DEFAULT_SUMMARY =
  'Pay for ticket bundles or use free entry routes, then answer three skill questions to qualify for the draw.'

/** Static public card when the API is down or the catalog row is missing. */
export function createFallbackLegacyBundleCompetition(overrides = {}) {
  if (!RONALDO_LEGACY_BUNDLE_ACTIVE) return null
  const publicBundles = TICKET_BUNDLES.filter((b) => !b.testOnly)
  const minBundlePence = publicBundles.length
    ? Math.min(...publicBundles.map((b) => b.totalPence))
    : null
  return {
    slug: DRAW_COMPETITION_SLUG,
    title: DRAW_COMPETITION_LABEL,
    summary: DEFAULT_SUMMARY,
    featuredOnHomepage: true,
    minBundlePence,
    bundleCount: publicBundles.length,
    ...legacyEntryMethods(),
    ...overrides,
  }
}

/** Signed Legacy Bundle — only surfaced when the feature flag is on (deactivated until relaunch). */
export function resolveLegacyBundlePublicCompetition({ detail, listItems } = {}) {
  if (!RONALDO_LEGACY_BUNDLE_ACTIVE) return null
  if (detail?.slug === DRAW_COMPETITION_SLUG) return detail
  const fromList = listItems?.find((c) => c.slug === DRAW_COMPETITION_SLUG)
  if (fromList) return fromList
  return createFallbackLegacyBundleCompetition()
}
