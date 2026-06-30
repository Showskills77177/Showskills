import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { localizedLayoutText } from '../../shared/i18n/localizedLayout.mjs'

/**
 * @param {string} key
 * @param {string | null | undefined} cmsValue
 * @param {string} englishDefault
 */
export function useLayoutCopy(key, cmsValue, englishDefault) {
  const { locale, t } = useSiteLocale()
  return localizedLayoutText(locale, t, key, cmsValue, englishDefault)
}

/**
 * @param {string} key
 * @param {string | null | undefined} cmsValue
 */
export function useLayoutCopyOrCms(key, cmsValue) {
  const { locale, t } = useSiteLocale()
  const trimmed = String(cmsValue || '').trim()
  if (!trimmed) return t(key)
  if (locale === 'en') return trimmed
  return t(key) || trimmed
}
