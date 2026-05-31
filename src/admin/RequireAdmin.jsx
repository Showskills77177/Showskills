import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAdminTheme } from './AdminThemeContext'
import { adminThemeRootClass } from './adminThemes.mjs'
import { apiFetch } from '../lib/api'

export function RequireAdmin() {
  const [status, setStatus] = useState('loading')
  const loc = useLocation()
  const { theme } = useAdminTheme()

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
      <div className={`${adminThemeRootClass(theme)} ${theme.loadingShell}`}>
        Checking session…
      </div>
    )
  }
  if (status === 'fail') {
    return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />
  }
  return <Outlet />
}
