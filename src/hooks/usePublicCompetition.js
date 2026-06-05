import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { getCachedCompetition, setCachedCompetition } from '../lib/publicDataCache.js'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

function fetchPublicCompetition(slug) {
  return apiFetch(`/api/competitions?slug=${encodeURIComponent(slug)}`).then(async (res) => {
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Failed to load competition')
    return j.competition || null
  })
}

export function usePublicCompetition(slug = DRAW_COMPETITION_SLUG) {
  const cacheKey = String(slug || '').trim() || DRAW_COMPETITION_SLUG
  const cached = getCachedCompetition(cacheKey)
  const [competition, setCompetition] = useState(cached ?? null)
  const [loading, setLoading] = useState(() => cached === undefined)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    return fetchPublicCompetition(cacheKey)
      .then((next) => {
        setCachedCompetition(cacheKey, next)
        setCompetition(next)
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [cacheKey])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchPublicCompetition(cacheKey)
      .then((next) => {
        if (cancelled) return
        setCachedCompetition(cacheKey, next)
        setCompetition(next)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    function onCompetitionUpdated(event) {
      const updatedSlug = event?.detail?.slug
      if (updatedSlug && updatedSlug !== cacheKey) return
      if (cancelled) return
      reload()
    }

    window.addEventListener('ss-competition-updated', onCompetitionUpdated)
    return () => {
      cancelled = true
      window.removeEventListener('ss-competition-updated', onCompetitionUpdated)
    }
  }, [cacheKey, reload])

  return { competition, loading, error, reload }
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
