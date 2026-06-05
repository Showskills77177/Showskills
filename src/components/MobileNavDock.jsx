import { NavLink } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'

const NAV_BTN_BASE =
  'ss-mobile-nav-btn flex min-h-[3rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center text-sm leading-tight transition'

function navBtnClass({ isActive }) {
  return isActive
    ? `${NAV_BTN_BASE} border-white/25 bg-white/10 text-white`
    : `${NAV_BTN_BASE} border-white/10 bg-transparent text-stone-400 hover:border-white/20 hover:bg-white/5 hover:text-white`
}

export function MobileNavDock({ navItems = [] }) {
  const { openTerms } = useEntryFlow()
  const mobileItems = navItems.filter((item) => item.mobile !== false && item.visible !== false)

  return (
    <div className="ss-mobile-nav-dock sm:hidden" aria-label="Site menu">
      <nav className="ss-mobile-nav-dock__grid grid gap-1.5 p-2.5 pt-2">
        {mobileItems.map((item) =>
          item.action === 'terms' ? (
            <button
              key={item.id}
              type="button"
              onClick={() => openTerms()}
              className={navBtnClass({ isActive: false })}
              aria-label={item.label}
            >
              <span className="ss-mobile-nav-label">{item.label}</span>
            </button>
          ) : (
            <NavLink key={item.id} to={item.path || '/'} end={item.path === '/'} className={navBtnClass}>
              <span className="ss-mobile-nav-label">{item.label}</span>
            </NavLink>
          ),
        )}
      </nav>
    </div>
  )
}
