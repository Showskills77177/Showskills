import { Link, NavLink } from 'react-router-dom'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

const signInClass = ({ isActive } = {}) =>
  `rounded-md px-1.5 py-1 text-sm text-white transition ${
    isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
  }`

const registerClass =
  'rounded-md px-1.5 py-1 text-sm font-bold uppercase tracking-wide text-lime-300 transition hover:text-lime-200'

/** Account / sign-in links for the right side of the header (desktop). */
export function HeaderRightAccountLinks() {
  const { user, status, logout } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') return null

  if (user) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <NavLink to="/account" className={signInClass}>
          {t('auth.account')}
        </NavLink>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md px-1.5 py-1 text-sm text-stone-400 transition hover:text-white"
        >
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <NavLink to="/login" className={signInClass}>
        {t('auth.signIn')}
      </NavLink>
      <Link to="/register" className={registerClass}>
        {t('auth.register')}
      </Link>
    </div>
  )
}

/** Compact auth links on the right for mobile header. */
export function MobileHeaderAccountLinks() {
  const { user, status, logout } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') return null

  if (user) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
        <NavLink to="/account" className={signInClass}>
          {t('auth.account')}
        </NavLink>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md px-1 py-0.5 text-xs text-stone-400 transition hover:text-white"
        >
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
      <NavLink to="/login" className={signInClass}>
        {t('auth.signIn')}
      </NavLink>
      <Link to="/register" className={`${registerClass} text-xs`}>
        {t('auth.register')}
      </Link>
    </div>
  )
}
