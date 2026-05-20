import { Link, NavLink, Outlet } from 'react-router-dom'
import showskillsLogo from '../assets/showskills-logo.png'
import { EntryModal } from './EntryModal'
import { TermsModal } from './TermsModal'
import { MobileNavDock } from './MobileNavDock'
import { useEntryFlow } from '../entry/entryContext'

function desktopNavClass({ isActive }) {
  return `rounded-md px-1.5 py-1 text-white transition ${
    isActive ? 'opacity-100' : 'opacity-90 hover:opacity-100'
  }`
}

function LogoMark({ className = 'h-10 sm:h-12' }) {
  return (
    <div
      role="img"
      aria-hidden
      className={`w-auto shrink-0 bg-stone-100 [aspect-ratio:745/235] ${className}`}
      style={{
        maskImage: `url(${showskillsLogo})`,
        WebkitMaskImage: `url(${showskillsLogo})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

export function Layout() {
  const { termsOpen, setTermsOpen, openTerms } = useEntryFlow()

  return (
    <div className="ss-page-bg min-h-svh font-sans text-stone-300 antialiased">
      <EntryModal />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      <header className="ss-header sticky top-0 z-40 border-b border-white/[0.06] bg-[#071512]/90 backdrop-blur-md">
        {/* Mobile: logo, then menu dock with its own footer strip */}
        <div className="sm:hidden">
          <div className="flex justify-center px-4 pb-2 pt-3">
            <Link
              to="/"
              className="outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
              aria-label="ShowSkills Rewards home"
            >
              <LogoMark className="h-11" />
            </Link>
          </div>
          <MobileNavDock />
        </div>

        {/* Desktop: classic three-column header */}
        <div className="relative z-10 mx-auto hidden max-w-5xl min-h-[4rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-y-0 px-6 py-2.5 sm:grid">
          <nav
            className="flex flex-wrap items-center justify-start gap-x-1 text-sm leading-normal"
            aria-label="Main navigation"
          >
            <NavLink to="/" end className={desktopNavClass}>
              Home
            </NavLink>
            <span className="select-none text-stone-600" aria-hidden>
              —
            </span>
            <NavLink to="/competitions" className={desktopNavClass}>
              Competitions
            </NavLink>
            <span className="select-none text-stone-600" aria-hidden>
              —
            </span>
            <button
              type="button"
              onClick={() => openTerms()}
              className="rounded-md px-1.5 py-1 text-white opacity-90 transition hover:opacity-100"
            >
              T&amp;C
            </button>
          </nav>

          <Link
            to="/"
            className="flex shrink-0 items-center justify-self-center outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
            aria-label="ShowSkills Rewards home"
          >
            <LogoMark />
          </Link>

          <div aria-hidden />
        </div>
      </header>

      <Outlet />

      <footer className="ss-footer-bg relative overflow-hidden border-t border-white/[0.06]">
        <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-center">
              <LogoMark className="h-8 sm:h-9" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link
                to="/competitions"
                className="text-sm font-medium text-stone-400 underline decoration-stone-600 underline-offset-4 hover:text-stone-200"
              >
                Competitions
              </Link>
              <button
                type="button"
                onClick={() => openTerms()}
                className="text-sm font-medium text-stone-400 underline decoration-stone-600 underline-offset-4 hover:text-stone-200"
              >
                Full terms &amp; privacy
              </button>
              <button
                type="button"
                onClick={() => {
                  openTerms()
                  window.setTimeout(() => {
                    document.getElementById('ss-terms-ticket-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 200)
                }}
                className="text-xs font-medium text-stone-500 underline decoration-stone-700 underline-offset-4 hover:text-stone-300"
              >
                Paid ticket terms
              </button>
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-md text-center text-sm text-stone-400">
            Paid draw: skill answers then random winner from correct entries. Free postal entry is in the same Legacy
            Bundle panel as paid tickets. UK-focused.
          </p>
          <p className="mt-8 border-t border-white/[0.06] pt-8 text-center text-xs leading-relaxed text-stone-600">
            Paid promotion is skill-based (not a lottery); winner chosen at random from entrants who answered all
            questions correctly. Not affiliated with any athlete, club, or brand shown in illustrative prize imagery.
          </p>
        </div>
      </footer>
    </div>
  )
}
