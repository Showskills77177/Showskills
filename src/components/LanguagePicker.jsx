import { SITE_LOCALE_OPTIONS } from '../../shared/i18n/localeMeta.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

/** Header language selector — twenty public locales. */
export function LanguagePicker({ className = '' }) {
  const { locale, setLocale, t } = useSiteLocale()

  return (
    <label
      className={`inline-flex items-center gap-0.5 rounded border border-white/10 bg-black/25 px-1 py-px text-[9px] leading-none text-stone-300 sm:text-[10px] ${className}`}
    >
      <span className="sr-only">{t('lang.label')}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="max-w-[4.75rem] cursor-pointer border-0 bg-transparent py-0 pl-0 pr-3 text-[9px] font-medium text-stone-100 focus:outline-none focus:ring-0 sm:max-w-[5.5rem] sm:text-[10px] sm:pr-3.5"
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
