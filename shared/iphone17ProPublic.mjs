import {
  IPHONE_17_PRO_BUNDLES,
  IPHONE_17_PRO_COMPETITION_ACTIVE,
  IPHONE_17_PRO_COMPETITION_LABEL,
  IPHONE_17_PRO_COMPETITION_SLUG,
  IPHONE_17_PRO_COMPETITION_SUMMARY,
  defaultPostalNameForIphone17ProCompetition,
} from './iphone17ProCompetition.mjs'

/** Static public card when the API is down or the catalog row is missing/unpublished. */
export function createFallbackIphone17ProCompetition(overrides = {}) {
  if (!IPHONE_17_PRO_COMPETITION_ACTIVE) return null
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

/** iPhone 17 Pro draw — only surfaced when the feature flag is on and the catalog is published. */
export function resolveIphone17ProPublicCompetition({ detail, listItems } = {}) {
  if (!IPHONE_17_PRO_COMPETITION_ACTIVE) return null
  if (detail?.slug === IPHONE_17_PRO_COMPETITION_SLUG) return detail
  const fromList = listItems?.find((c) => c.slug === IPHONE_17_PRO_COMPETITION_SLUG)
  if (fromList) return fromList
  return createFallbackIphone17ProCompetition()
}
