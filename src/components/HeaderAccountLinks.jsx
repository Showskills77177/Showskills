import { Link } from 'react-router-dom'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

const linkClass =
  'rounded-md px-1.5 py-1 text-sm text-white opacity-90 transition hover:opacity-100'

export function HeaderAccountLinks({ className = '' }) {
  const { user, status, logout } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') {
    return <span className={`text-sm text-stone-500 ${className}`}>{t('common.loading')}</span>
  }

  if (user) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <Link to="/account" className={linkClass}>
          {t('auth.account')}
        </Link>
        <button type="button" onClick={() => logout()} className={linkClass}>
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Link to="/login" className={linkClass}>
        {t('auth.signIn')}
      </Link>
      <Link
        to="/register"
        className="rounded-md bg-lime-500/15 px-2 py-1 text-sm font-medium text-lime-300 transition hover:bg-lime-500/25"
      >
        {t('auth.register')}
      </Link>
    </div>
  )
}
