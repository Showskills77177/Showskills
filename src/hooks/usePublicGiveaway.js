import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export function usePublishedGiveaways() {
  const [giveaways, setGiveaways] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()
    const timeout = window.setTimeout(() => ac.abort(), 20_000)
    apiFetch('/api/giveaways', { signal: ac.signal })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!cancelled) setGiveaways(j.giveaways || [])
      })
      .catch(() => {
        if (!cancelled) setGiveaways([])
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
