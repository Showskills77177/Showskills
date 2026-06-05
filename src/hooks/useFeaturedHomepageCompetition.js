import { useCallback, useEffect, useState } from 'react'
import {
  fetchFeaturedHomepageCompetition,
  hydrateFeaturedHomepageCompetitionCache,
} from '../lib/publicCatalogFetch.js'
import { getCachedFeaturedHomepageCompetition } from '../lib/publicDataCache.js'

export function useFeaturedHomepageCompetition() {
  hydrateFeaturedHomepageCompetitionCache()
  const cached = getCachedFeaturedHomepageCompetition()
  const [competition, setCompetition] = useState(cached ?? null)
  const [loading, setLoading] = useState(() => cached === undefined)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    return fetchFeaturedHomepageCompetition()
      .then((next) => {
        setCompetition(next)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    const hasCache = getCachedFeaturedHomepageCompetition() !== undefined
    if (!hasCache) setLoading(true)
    setError('')

    fetchFeaturedHomepageCompetition()
      .then((next) => {
        if (cancelled) return
        setCompetition(next)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    function onCompetitionUpdated() {
      if (cancelled) return
      reload()
    }

    window.addEventListener('ss-competition-updated', onCompetitionUpdated)
    return () => {
      cancelled = true
      window.removeEventListener('ss-competition-updated', onCompetitionUpdated)
    }
  }, [reload])

  return { competition, loading, error, reload }
}
