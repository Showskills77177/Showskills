import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useUserAuth } from './UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

export function RequireUser() {
  const { status } = useUserAuth()
  const loc = useLocation()
  const { t } = useSiteLocale()

  if (status === 'loading') {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center text-stone-400">
        {t('common.loading')}
      </main>
    )
  }
  if (status !== 'ok') {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }
  return <Outlet />
}
