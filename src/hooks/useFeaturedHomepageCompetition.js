import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  getCachedFeaturedHomepageCompetition,
  setCachedFeaturedHomepageCompetition,
} from '../lib/publicDataCache.js'

function fetchFeaturedHomepageCompetition() {
  return apiFetch('/api/competitions?featured=homepage').then(async (res) => {
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Failed to load featured competition')
    return j.competition || null
  })
}

export function useFeaturedHomepageCompetition() {
  const cached = getCachedFeaturedHomepageCompetition()
  const [competition, setCompetition] = useState(cached ?? null)
  const [loading, setLoading] = useState(() => cached === undefined)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    return fetchFeaturedHomepageCompetition()
      .then((next) => {
        setCachedFeaturedHomepageCompetition(next)
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
    setLoading(true)
    setError('')
    fetchFeaturedHomepageCompetition()
      .then((next) => {
        if (cancelled) return
        setCachedFeaturedHomepageCompetition(next)
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
