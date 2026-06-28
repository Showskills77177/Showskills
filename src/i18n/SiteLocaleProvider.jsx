import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '../lib/api'
import {
  DEFAULT_SITE_LOCALE,
  SITE_LOCALE_STORAGE_KEY,
  normalizeSiteLocale,
  siteLocaleDirection,
} from '../../shared/i18n/localeMeta.mjs'
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
  const [locale, setLocaleState] = useState(() => {
    const stored = readStoredLocale()
    if (stored !== DEFAULT_SITE_LOCALE || typeof window === 'undefined') return stored
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
        const res = await fetch(apiUrl('/api/visitor/region'), { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (cancelled || !res.ok) return
        setRegion({
          countryCode: data.countryCode || null,
          countryName: data.countryName || null,
          isUk: Boolean(data.isUk),
          paidBundlesAvailable: Boolean(data.paidBundlesAvailable),
          giveawaysInternational: data.giveawaysInternational !== false,
          loading: false,
        })
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
    setLocaleState(code)
    try {
      localStorage.setItem(SITE_LOCALE_STORAGE_KEY, code)
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
