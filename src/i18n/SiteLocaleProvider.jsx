import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_MANUAL_KEY,
  SITE_LOCALE_STORAGE_KEY,
  coerceOptionalSiteLocale,
  normalizeSiteLocale,
  siteLocaleDirection,
} from '../../shared/i18n/localeMeta.mjs'
import { resolveGeoSiteLocale } from '../../shared/i18n/geoLocale.mjs'
import { t as translate } from '../../shared/i18n/translate.mjs'

const SiteLocaleContext = createContext({
  locale: DEFAULT_SITE_LOCALE,
  setLocale: () => {},
  t: (key) => key,
  region: {
    countryCode: null,
    countryName: null,
    isUk: true,
    paidBundlesAvailable: true,
    giveawaysInternational: true,
    loading: true,
  },
})

function readStoredLocale() {
  if (typeof window === 'undefined') return DEFAULT_SITE_LOCALE
  try {
    return normalizeSiteLocale(localStorage.getItem(SITE_LOCALE_STORAGE_KEY))
  } catch {
    return DEFAULT_SITE_LOCALE
  }
}

function readLocaleManual() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(SITE_LOCALE_MANUAL_KEY) === '1'
  } catch {
    return false
  }
}

function detectBrowserLocale() {
  if (typeof navigator === 'undefined') return DEFAULT_SITE_LOCALE
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const tag of tags) {
    const code = normalizeSiteLocale(tag)
    if (code) return code
  }
  return DEFAULT_SITE_LOCALE
}

export function SiteLocaleProvider({ children }) {
  const localeManualRef = useRef(readLocaleManual())
  const [locale, setLocaleState] = useState(() => {
    if (localeManualRef.current) return readStoredLocale()
    if (typeof window === 'undefined') return DEFAULT_SITE_LOCALE
    return detectBrowserLocale()
  })
  const [region, setRegion] = useState({
    countryCode: null,
    countryName: null,
    isUk: true,
    paidBundlesAvailable: true,
    giveawaysInternational: true,
    loading: true,
  })

  useEffect(() => {
    const dir = siteLocaleDirection(locale)
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await apiFetch('/api/visitor/region')
        const data = await res.json().catch(() => ({}))
        if (cancelled || !res.ok) return

        const nextRegion = {
          countryCode: data.countryCode || null,
          countryName: data.countryName || null,
          isUk: Boolean(data.isUk),
          paidBundlesAvailable: Boolean(data.paidBundlesAvailable),
          giveawaysInternational: data.giveawaysInternational !== false,
          loading: false,
        }
        setRegion(nextRegion)

        if (!localeManualRef.current) {
          const geoLocale =
            coerceOptionalSiteLocale(data.suggestedLocale) ||
            resolveGeoSiteLocale(data.countryCode, detectBrowserLocale())
          setLocaleState(geoLocale)
          try {
            localStorage.setItem(SITE_LOCALE_STORAGE_KEY, geoLocale)
          } catch {
            /* ignore */
          }
        }
      } catch {
        if (!cancelled) {
          setRegion((prev) => ({ ...prev, loading: false }))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const setLocale = useCallback((next) => {
    const code = normalizeSiteLocale(next)
    localeManualRef.current = true
    setLocaleState(code)
    try {
      localStorage.setItem(SITE_LOCALE_STORAGE_KEY, code)
      localStorage.setItem(SITE_LOCALE_MANUAL_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback((key, params) => translate(locale, key, params), [locale])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      region,
    }),
    [locale, region, setLocale, t],
  )

  return <SiteLocaleContext.Provider value={value}>{children}</SiteLocaleContext.Provider>
}

export function useSiteLocale() {
  return useContext(SiteLocaleContext)
}
