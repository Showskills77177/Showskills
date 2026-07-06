import { SITE_LOCALE_OPTIONS } from '../../shared/i18n/localeMeta.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

/** Header language selector — twenty public locales. */
export function LanguagePicker({ className = '' }) {
  const { locale, setLocale, t } = useSiteLocale()

  return (
    <label
      className={`inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 text-[10px] leading-tight text-stone-300 sm:text-[11px] ${className}`}
    >
      <span className="sr-only">{t('lang.label')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="max-w-[5.5rem] cursor-pointer border-0 bg-transparent py-0 pl-0 pr-4 text-[10px] font-medium text-stone-100 focus:outline-none focus:ring-0 sm:max-w-[6.5rem] sm:text-[11px] sm:pr-5"
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
