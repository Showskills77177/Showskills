import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export function useFeaturedHomepageCompetition() {
  const [competition, setCompetition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiFetch('/api/competitions?featured=homepage')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load featured competition')
        if (!cancelled) setCompetition(j.competition || null)
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
