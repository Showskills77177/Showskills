import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { fetchPublishedGiveaways } from '../lib/publicCatalogFetch.js'
import { getCachedPublishedGiveaways } from '../lib/publicDataCache.js'

export function usePublishedGiveaways() {
  const cached = getCachedPublishedGiveaways()
  const [giveaways, setGiveaways] = useState(cached ?? [])
  const [loading, setLoading] = useState(() => cached === undefined)

  useEffect(() => {
    let cancelled = false
    const hasCache = getCachedPublishedGiveaways() !== undefined
    if (!hasCache) setLoading(true)

    fetchPublishedGiveaways()
      .then((next) => {
        if (!cancelled) setGiveaways(next)
      })
      .catch(() => {
        if (!cancelled) setGiveaways([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { giveaways, loading }
}

export function usePublicGiveaway(slug) {
  const [giveaway, setGiveaway] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) {
      setGiveaway(null)
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    apiFetch(`/api/giveaways?slug=${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Failed to load giveaway')
        if (!cancelled) setGiveaway(j.giveaway || null)
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

  return { giveaway, loading, error }
}
