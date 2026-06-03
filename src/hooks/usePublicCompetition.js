import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { getCachedCompetition, setCachedCompetition } from '../lib/publicDataCache.js'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

export function usePublicCompetition(slug = DRAW_COMPETITION_SLUG) {
  const cacheKey = String(slug || '').trim() || DRAW_COMPETITION_SLUG
  const cached = getCachedCompetition(cacheKey)
  const [competition, setCompetition] = useState(cached ?? null)
  const [loading, setLoading] = useState(() => cached === undefined)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (cached === undefined) setLoading(true)
    setError('')
    apiFetch(`/api/competitions?slug=${encodeURIComponent(cacheKey)}`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load competition')
        if (!cancelled) {
          const next = j.competition || null
          setCachedCompetition(cacheKey, next)
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
  }, [cacheKey])

  return { competition, loading, error }
}

export function usePublishedCompetitions() {
  const [competitions, setCompetitions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const timeout = window.setTimeout(() => ac.abort(), 20_000)
    apiFetch('/api/competitions', { signal: ac.signal })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!cancelled) setCompetitions(j.competitions || [])
      })
      .catch(() => {
        if (!cancelled) setCompetitions([])
      })
      .finally(() => {
        window.clearTimeout(timeout)
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      ac.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  return { competitions, loading }
}
