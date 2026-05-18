import { NavLink } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'

function navBtnClass({ isActive }) {
  return `ss-mobile-nav-btn flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-3 text-center text-sm font-bold leading-tight transition ${
    isActive
      ? 'border-emerald-400/50 bg-emerald-950/70 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.12)]'
      : 'border-white/12 bg-[#0a1f19]/90 text-stone-200 hover:border-emerald-500/35 hover:bg-emerald-950/40'
  }`
}

export function MobileNavDock() {
  const { openTerms } = useEntryFlow()

  return (
    <div className="ss-mobile-nav-dock sm:hidden" aria-label="Site menu">
      <nav className="ss-mobile-nav-dock__grid grid grid-cols-3 gap-2.5 p-3 pt-2">
        <NavLink to="/" end className={navBtnClass}>
          Home
        </NavLink>
        <NavLink to="/competitions" className={navBtnClass}>
          Competitions
        </NavLink>
        <button type="button" onClick={() => openTerms()} className={navBtnClass({ isActive: false })}>
          T&amp;C
        </button>
      </nav>
      <div className="ss-mobile-nav-dock__foot border-t border-emerald-900/35 bg-[#050f0d]/95 px-3 py-2 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">ShowSkills Rewards</p>
      </div>
    </div>
  )
}
