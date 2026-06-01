import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

export function usePublicWinners() {
  const [data, setData] = useState({ enabled: false, winners: [], title: '', subtitle: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/public-winners')
      .then(async (res) => {
        const j = await res.json().catch(() => ({}))
        if (!cancelled) {
          setData({
            enabled: Boolean(j.enabled),
            winners: j.winners || [],
            title: j.title || 'Recent winners',
            subtitle: j.subtitle || '',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { ...data, loading }
}
