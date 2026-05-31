import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

export function usePublicCompetition(slug = DRAW_COMPETITION_SLUG) {
  const [competition, setCompetition] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    apiFetch(`/api/competitions?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load competition')
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
  }, [slug])

  return { competition, loading, error }
}

export function usePublishedCompetitions() {
  const [competitions, setCompetitions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/competitions')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!cancelled) setCompetitions(j.competitions || [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { competitions, loading }
}
