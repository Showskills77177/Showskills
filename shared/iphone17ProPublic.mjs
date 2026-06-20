import {
  IPHONE_17_PRO_BUNDLES,
  IPHONE_17_PRO_COMPETITION_LABEL,
  IPHONE_17_PRO_COMPETITION_SLUG,
  IPHONE_17_PRO_COMPETITION_SUMMARY,
  defaultPostalNameForIphone17ProCompetition,
} from './iphone17ProCompetition.mjs'

/** Static public card when the API is down or the catalog row is missing/unpublished. */
export function createFallbackIphone17ProCompetition(overrides = {}) {
  const publicBundles = IPHONE_17_PRO_BUNDLES.filter((b) => !b.testOnly)
  const minBundlePence = publicBundles.length
    ? Math.min(...publicBundles.map((b) => b.totalPence))
    : 29
  return {
    slug: IPHONE_17_PRO_COMPETITION_SLUG,
    title: IPHONE_17_PRO_COMPETITION_LABEL,
    summary: IPHONE_17_PRO_COMPETITION_SUMMARY,
    minBundlePence,
    bundleCount: publicBundles.length,
    allowPaidEntry: true,
    allowFreeOnline: true,
    allowPostalEntry: true,
    postalCompetitionName: defaultPostalNameForIphone17ProCompetition(),
    ...overrides,
  }
}

/** iPhone 17 Pro draw is always shown on homepage and Competitions — prefer live API data. */
export function resolveIphone17ProPublicCompetition({ detail, listItems } = {}) {
  if (detail?.slug === IPHONE_17_PRO_COMPETITION_SLUG) return detail
  const fromList = listItems?.find((c) => c.slug === IPHONE_17_PRO_COMPETITION_SLUG)
  if (fromList) return fromList
  return createFallbackIphone17ProCompetition()
}
