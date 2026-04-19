import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export function RequireAdmin() {
  const [status, setStatus] = useState('loading')
  const loc = useLocation()

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/admin/me')
      .then((r) => {
        if (!cancelled) setStatus(r.ok ? 'ok' : 'fail')
      })
      .catch(() => {
        if (!cancelled) setStatus('fail')
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-400">
        Checking session…
      </div>
    )
  }
  if (status === 'fail') {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  }
  return <Outlet />
}
