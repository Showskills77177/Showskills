import { NavLink } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'

const NAV_BTN_BASE =
  'ss-mobile-nav-btn flex min-h-[2.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1.5 py-2 text-center text-xs leading-tight transition'

function navBtnClass({ isActive }) {
  return isActive
    ? `${NAV_BTN_BASE} border-white/25 bg-white/10 text-white`
    : `${NAV_BTN_BASE} border-white/10 bg-transparent text-stone-400 hover:border-white/20 hover:bg-white/5 hover:text-white`
}

export function MobileNavDock() {
  const { openTerms } = useEntryFlow()

  return (
    <div className="ss-mobile-nav-dock sm:hidden" aria-label="Site menu">
      <nav className="ss-mobile-nav-dock__grid grid gap-1.5 p-2.5 pt-2">
        <NavLink to="/" end className={navBtnClass}>
          <span className="ss-mobile-nav-label">Home</span>
        </NavLink>
        <NavLink to="/competitions" className={navBtnClass} aria-label="Competitions">
          <span className="ss-mobile-nav-label">Competitions</span>
        </NavLink>
        <NavLink to="/faq" className={navBtnClass}>
          <span className="ss-mobile-nav-label">FAQ</span>
        </NavLink>
        <button
          type="button"
          onClick={() => openTerms()}
          className={navBtnClass({ isActive: false })}
          aria-label="Terms and conditions"
        >
          <span className="ss-mobile-nav-label">T&amp;C</span>
        </button>
      </nav>
    </div>
  )
}
