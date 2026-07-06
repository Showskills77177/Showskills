import { Link, NavLink } from 'react-router-dom'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

const desktopNavClass = ({ isActive }) =>
  `ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white transition ${
    isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
  }`

const MOBILE_BTN_BASE =
  'ss-mobile-nav-btn flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center text-sm leading-tight transition'

function mobileBtnClass({ isActive } = {}) {
  return isActive
    ? `${MOBILE_BTN_BASE} border-white/25 bg-white/10 text-white`
    : `${MOBILE_BTN_BASE} border-white/10 bg-transparent text-stone-400 hover:border-white/20 hover:bg-white/5 hover:text-white`
}

/** Auth links inline with desktop header nav (after Home, FAQ, etc.). */
export function DesktopNavAccountLinks() {
  const { user, status, logout } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') return null

  if (user) {
    return (
      <>
        <span className="select-none text-stone-600" aria-hidden>
          —
        </span>
        <NavLink to="/account" className={desktopNavClass}>
          {t('auth.account')}
        </NavLink>
        <span className="select-none text-stone-600" aria-hidden>
          —
        </span>
        <button
          type="button"
          onClick={() => logout()}
          className="rounded-md px-1.5 py-1 text-sm text-stone-400 transition hover:text-white"
        >
          {t('auth.signOut')}
        </button>
      </>
    )
  }

  return (
    <>
      <span className="select-none text-stone-600" aria-hidden>
        —
      </span>
      <NavLink to="/login" className={desktopNavClass}>
        {t('auth.signIn')}
      </NavLink>
      <span className="select-none text-stone-600" aria-hidden>
        —
      </span>
      <Link
        to="/register"
        className="rounded-md px-1.5 py-1 text-sm font-bold uppercase tracking-wide text-lime-300 transition hover:text-lime-200"
      >
        {t('auth.register')}
      </Link>
    </>
  )
}

/** Auth links in the mobile nav dock grid. */
export function MobileNavAccountLinks() {
  const { user, status, logout } = useUserAuth()
  const { t } = useSiteLocale()

  if (status === 'loading') return null

  if (user) {
    return (
      <>
        <NavLink to="/account" className={mobileBtnClass}>
          <span className="ss-mobile-nav-label">{t('auth.account')}</span>
        </NavLink>
        <button type="button" onClick={() => logout()} className={mobileBtnClass()}>
          <span className="ss-mobile-nav-label text-stone-400">{t('auth.signOut')}</span>
        </button>
      </>
    )
  }

  return (
    <>
      <NavLink to="/login" className={mobileBtnClass}>
        <span className="ss-mobile-nav-label">{t('auth.signIn')}</span>
      </NavLink>
      <Link
        to="/register"
        className={`${MOBILE_BTN_BASE} border-lime-500/35 bg-lime-500/10 text-lime-300 hover:border-lime-400/50 hover:bg-lime-500/20 hover:text-lime-200`}
      >
        <span className="ss-mobile-nav-label font-bold uppercase tracking-wide">{t('auth.register')}</span>
      </Link>
    </>
  )
}
