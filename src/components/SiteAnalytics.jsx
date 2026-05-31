import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPublicPageView } from '../lib/siteAnalytics.mjs'

/** Records anonymous page views for the admin dashboard analytics panels. */
export function SiteAnalytics() {
  const { pathname, search } = useLocation()

  useEffect(() => {
    trackPublicPageView(pathname, search)
  }, [pathname, search])

  return null
}
