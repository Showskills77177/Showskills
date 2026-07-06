import { Link, NavLink } from 'react-router-dom'
import { useUserAuth, userDisplayName } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

const authLinkClass =
  'ss-desktop-nav-link rounded-md px-1 py-1 text-sm text-white opacity-90 transition hover:opacity-100'

const registerClass =
  'ss-desktop-nav-link rounded-md px-1 py-1 text-xs font-semibold uppercase tracking-wide text-lime-300 transition hover:text-lime-200 sm:text-sm'

const authGroupClass = 'flex flex-wrap items-center gap-x-0'

const profileNavClass = ({ isActive }) =>
  `ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white transition ${
    isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
  }`

export function NavDash() {
  return (
    <span className="select-none text-stone-600" aria-hidden>
      —
    </span>
  )
}

export function HeaderRightAccountLinks() {
  const { user, status, logout, openAuthModal } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') return null

  if (user) {
    const name = userDisplayName(user)
    return (
      <div className={authGroupClass}>
        <NavLink to="/account" className={authLinkClass}>
          {name}
        </NavLink>
        <NavDash />
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md px-1 py-1 text-sm text-stone-400 transition hover:text-white"
        >
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <div className={authGroupClass}>
      <button type="button" onClick={() => openAuthModal('login')} className={authLinkClass}>
        {t('auth.signIn')}
      </button>
      <NavDash />
      <button type="button" onClick={() => openAuthModal('register')} className={registerClass}>
        {t('auth.register')}
      </button>
    </div>
  )
}

export function MobileHeaderAccountLinks() {
  const { user, status, logout, openAuthModal } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') return null

  if (user) {
    const name = userDisplayName(user)
    return (
      <div className={authGroupClass}>
        <NavLink to="/account" className={authLinkClass}>
          {name}
        </NavLink>
        <NavDash />
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md px-1 py-1 text-sm text-stone-400 transition hover:text-white"
        >
          {t('auth.signOut')}
        </button>
      </div>
    )
  }

  return (
    <div className={authGroupClass}>
      <button type="button" onClick={() => openAuthModal('login')} className={authLinkClass}>
        {t('auth.signIn')}
      </button>
      <NavDash />
      <button type="button" onClick={() => openAuthModal('register')} className={registerClass}>
        {t('auth.register')}
      </button>
    </div>
  )
}

export function NavProfileSettingsButton() {
  const { user, status } = useUserAuth()
  const { t } = useSiteLocale()

  if (status !== 'ok' || !user) return null

  return (
    <NavLink to="/account" className={profileNavClass}>
      {t('auth.profileSettings')}
    </NavLink>
  )
}
