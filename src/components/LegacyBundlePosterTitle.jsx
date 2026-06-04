/** “Signed” prefix on the poster — gold Bebas, aligned with baked-in “LEGACY BUNDLE”. */
export function LegacyBundlePosterTitle({ className = '' }) {
  return (
    <p className={`ss-legacy-bundle-poster-title ${className}`.trim()} aria-hidden>
      Signed
    </p>
  )
}
