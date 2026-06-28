import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

/** Explains UK-only bundles vs international giveaways for non-UK visitors. */
export function RegionNoticeBanner({ className = '' }) {
  const { region, t } = useSiteLocale()

  if (region.loading || region.paidBundlesAvailable) return null

  return (
    <div
      className={`border-b border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-sky-950/35 to-amber-950/40 px-4 py-3 text-sm text-stone-200 ${className}`}
      role="status"
    >
      <p className="mx-auto max-w-5xl">
        <strong className="text-amber-100">{t('region.giveawaysWorldTitle')}</strong>
        {' — '}
        {t('region.giveawaysWorldBody')}{' '}
        <span className="text-stone-400">{t('region.paidUkOnlyBody')}</span>
      </p>
    </div>
  )
}
