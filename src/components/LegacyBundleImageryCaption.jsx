import { LegacyBundleCollectiblesStamp } from './LegacyBundleCollectiblesStamp'

/** Collectibles stamp overlaid on the poster, to the right of the white “LEGACY BUNDLE” line. */
export function LegacyBundleImageryCaption({ className = '' }) {
  return (
    <div className={`ss-legacy-bundle-stamp-overlay ${className}`.trim()} aria-label="Collectibles">
      <LegacyBundleCollectiblesStamp size="md" />
    </div>
  )
}
