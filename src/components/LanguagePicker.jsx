import { SITE_LOCALE_OPTIONS } from '../../shared/i18n/localeMeta.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

/** Header language selector — twenty public locales. */
export function LanguagePicker({ className = '' }) {
  const { locale, setLocale, t } = useSiteLocale()

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-xs text-stone-300 ${className}`}
    >
      <span className="sr-only">{t('lang.label')}</span>
      <span className="hidden font-semibold uppercase tracking-wider text-stone-500 sm:inline" aria-hidden>
        {t('lang.label')}
      </span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="max-w-[7.5rem] cursor-pointer border-0 bg-transparent py-0.5 pl-0 pr-6 text-xs font-semibold text-stone-100 focus:outline-none focus:ring-0 sm:max-w-none"
        aria-label={t('lang.label')}
      >
        {SITE_LOCALE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
