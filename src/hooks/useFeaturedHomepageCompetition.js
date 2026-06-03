import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import {
  getCachedFeaturedHomepageCompetition,
  setCachedFeaturedHomepageCompetition,
} from '../lib/publicDataCache.js'

export function useFeaturedHomepageCompetition() {
  const cached = getCachedFeaturedHomepageCompetition()
  const [competition, setCompetition] = useState(cached ?? null)
  const [loading, setLoading] = useState(() => cached === undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (cached === undefined) setLoading(true)
    setError('')
    apiFetch('/api/competitions?featured=homepage')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load featured competition')
        if (!cancelled) {
          const next = j.competition || null
          setCachedFeaturedHomepageCompetition(next)
          setCompetition(next)
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { competition, loading, error }
}
