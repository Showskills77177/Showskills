import { NavLink } from 'react-router-dom'
import { useEntryFlow } from '../entry/entryContext'

const NAV_BTN_BASE =
  'ss-mobile-nav-btn flex min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center text-xs font-bold leading-tight transition'

function navBtnClass({ isActive }, tone) {
  const tones = {
    home: isActive
      ? 'border-emerald-400/50 bg-emerald-950/70 text-emerald-100'
      : 'border-emerald-800/40 bg-emerald-950/35 text-emerald-100/90 hover:border-emerald-500/40 hover:bg-emerald-950/55',
    competitions: isActive
      ? 'border-cyan-400/50 bg-cyan-950/55 text-cyan-100'
      : 'border-cyan-900/45 bg-cyan-950/30 text-cyan-100/85 hover:border-cyan-500/40 hover:bg-cyan-950/50',
    terms: isActive
      ? 'border-stone-400/40 bg-stone-900/70 text-stone-200'
      : 'border-stone-600/35 bg-stone-950/50 text-stone-300 hover:border-stone-500/40 hover:bg-stone-900/60',
  }
  return `${NAV_BTN_BASE} ${tones[tone] ?? tones.home}`
}

export function MobileNavDock() {
  const { openTerms } = useEntryFlow()

  return (
    <div className="ss-mobile-nav-dock sm:hidden" aria-label="Site menu">
      <nav className="ss-mobile-nav-dock__grid grid grid-cols-3 gap-2 p-2.5 pt-2">
        <NavLink to="/" end className={({ isActive }) => navBtnClass({ isActive }, 'home')}>
          Home
        </NavLink>
        <NavLink to="/competitions" className={({ isActive }) => navBtnClass({ isActive }, 'competitions')}>
          Competitions
        </NavLink>
        <button type="button" onClick={() => openTerms()} className={navBtnClass({ isActive: false }, 'terms')}>
          T&amp;C
        </button>
      </nav>
    </div>
  )
}
