import { NavLink } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'
import { translateNavLabel } from '../../shared/i18n/translate.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { useUserAuth } from '../auth/UserAuthProvider'

const NAV_BTN_BASE =
  'ss-mobile-nav-btn flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center text-sm leading-tight transition'

export function mobileNavBtnClass({ isActive = false } = {}) {
  return isActive
    ? `${NAV_BTN_BASE} border-white/25 bg-white/10 text-white`
    : `${NAV_BTN_BASE} border-white/10 bg-transparent text-stone-400 hover:border-white/20 hover:bg-white/5 hover:text-white`
}

export function mobileNavBtnAccentClass() {
  return `${NAV_BTN_BASE} border-lime-400/35 bg-lime-500/10 text-lime-200 hover:border-lime-300/50 hover:bg-lime-500/15 hover:text-lime-100`
}

function navBtnClass({ isActive }) {
  return mobileNavBtnClass({ isActive })
}

export function MobileNavDock({ navItems = [] }) {
  const { openTerms } = useEntryFlow()
  const { locale, t } = useSiteLocale()
  const { user, status, openAuthModal, logout } = useUserAuth()
  const isLoggedIn = status === 'ok' && Boolean(user)
  const mobileItems = navItems.filter((item) => item.mobile !== false && item.visible !== false)

  return (
    <div className="ss-mobile-nav-dock sm:hidden" aria-label="Site menu">
      <nav className="ss-mobile-nav-dock__grid grid gap-1.5 p-2.5 pt-2">
        {mobileItems.map((item) => {
          const label = translateNavLabel(locale, item)
          if (item.action === 'terms') {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openTerms()}
                className={navBtnClass({ isActive: false })}
                aria-label={label}
              >
                <span className="ss-mobile-nav-label">{label}</span>
              </button>
            )
          }
          return (
            <NavLink key={item.id} to={item.path || '/'} end={item.path === '/'} className={navBtnClass}>
              <span className="ss-mobile-nav-label">{label}</span>
            </NavLink>
          )
        })}
        {isLoggedIn ? (
          <>
            <NavLink to="/account" className={navBtnClass}>
              <span className="ss-mobile-nav-label">{t('auth.profileSettings')}</span>
            </NavLink>
            <button
              type="button"
              onClick={() => logout()}
              className={navBtnClass({ isActive: false })}
            >
              <span className="ss-mobile-nav-label">{t('auth.signOut')}</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className={navBtnClass({ isActive: false })}
            >
              <span className="ss-mobile-nav-label">{t('auth.signIn')}</span>
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className={mobileNavBtnAccentClass()}
            >
              <span className="ss-mobile-nav-label">{t('auth.register')}</span>
            </button>
          </>
        )}
      </nav>
    </div>
  )
}
