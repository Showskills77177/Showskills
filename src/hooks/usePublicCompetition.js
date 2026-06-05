import { useCallback, useEffect, useState } from 'react'
import {
  fetchPublicCompetitionBySlug,
  fetchPublishedCompetitions,
  hydrateCompetitionCache,
} from '../lib/publicCatalogFetch.js'
import { getCachedCompetition, getCachedPublishedCompetitions } from '../lib/publicDataCache.js'
import { DRAW_COMPETITION_SLUG } from '../../shared/competitionPeriods.mjs'

export function usePublicCompetition(slug = DRAW_COMPETITION_SLUG) {
  const cacheKey = String(slug || '').trim() || DRAW_COMPETITION_SLUG
  hydrateCompetitionCache(cacheKey)
  const cached = getCachedCompetition(cacheKey)
  const [competition, setCompetition] = useState(cached ?? null)
  const [loading, setLoading] = useState(() => cached === undefined)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setError('')
    return fetchPublicCompetitionBySlug(cacheKey)
      .then((next) => {
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
    const hasCache = getCachedCompetition(cacheKey) !== undefined
    if (!hasCache) setLoading(true)
    setError('')

    fetchPublicCompetitionBySlug(cacheKey)
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
  const cached = getCachedPublishedCompetitions()
  const [competitions, setCompetitions] = useState(cached ?? [])
  const [loading, setLoading] = useState(() => cached === undefined)

  useEffect(() => {
    let cancelled = false
    const hasCache = getCachedPublishedCompetitions() !== undefined
    if (!hasCache) setLoading(true)

    fetchPublishedCompetitions()
      .then((next) => {
        if (!cancelled) setCompetitions(next)
      })
      .catch(() => {
        if (!cancelled) setCompetitions([])
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
