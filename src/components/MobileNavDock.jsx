import { NavLink } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'

const NAV_BTN_BASE =
  'ss-mobile-nav-btn flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center text-xs font-bold leading-tight transition'

function navBtnClass({ isActive }) {
  return isActive
    ? `${NAV_BTN_BASE} border-white/25 bg-white/10 text-white`
    : `${NAV_BTN_BASE} border-white/10 bg-transparent text-stone-400 hover:border-white/20 hover:bg-white/5 hover:text-white`
}

export function MobileNavDock() {
  const { openTerms } = useEntryFlow()

  return (
    <div className="ss-mobile-nav-dock sm:hidden" aria-label="Site menu">
      <nav className="ss-mobile-nav-dock__grid grid grid-cols-4 gap-1.5 p-2.5 pt-2">
        <NavLink to="/" end className={navBtnClass}>
          Home
        </NavLink>
        <NavLink to="/competitions" className={navBtnClass}>
          Compete
        </NavLink>
        <NavLink to="/faq" className={navBtnClass}>
          FAQ
        </NavLink>
        <button type="button" onClick={() => openTerms()} className={navBtnClass({ isActive: false })}>
          T&amp;C
        </button>
      </nav>
    </div>
  )
}
