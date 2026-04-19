import { Link, NavLink, Outlet } from 'react-router-dom'
import showskillsLogo from '../assets/showskills-logo.png'
import { EntryModal } from './EntryModal'
import { TermsModal } from './TermsModal'
import { useEntryFlow } from '../entry/entryContext'
import { SkillMeterIcon } from './siteChrome'

function navClass({ isActive }) {
  return `rounded-md px-1.5 py-1 transition ${
    isActive ? 'text-emerald-200' : 'text-stone-400 hover:text-stone-100'
  }`
}

export function Layout() {
  const { termsOpen, setTermsOpen, openTerms } = useEntryFlow()

  return (
    <div className="ss-page-bg min-h-svh font-sans text-stone-300 antialiased">
      <EntryModal />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      <header className="ss-header sticky top-0 z-40 border-b border-white/[0.06] bg-[#071512]/90 backdrop-blur-md">
        <div className="relative mx-auto flex min-h-[3.25rem] max-w-5xl items-center px-4 py-2 sm:min-h-[3.5rem] sm:px-6">
          <div className="relative z-20 flex min-w-0 flex-1 justify-start pr-2">
            <nav
              className="flex flex-wrap items-center gap-x-1 text-xs font-semibold sm:text-sm"
              aria-label="Main navigation"
            >
              <NavLink to="/" end className={navClass}>
                Home
              </NavLink>
              <span className="select-none text-stone-600" aria-hidden>
                —
              </span>
              <NavLink to="/competitions" className={navClass}>
                Competitions
              </NavLink>
              <span className="select-none text-stone-600" aria-hidden>
                —
              </span>
              <button
                type="button"
                onClick={() => openTerms()}
                className="rounded-md px-1.5 py-1 text-stone-400 transition hover:text-stone-100"
              >
                T&amp;C
              </button>
            </nav>
          </div>

          <Link
            to="/"
            className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
            aria-label="ShowSkills Rewards home"
          >
            <div
              role="img"
              aria-hidden
              className="h-10 w-auto shrink-0 bg-stone-100 [aspect-ratio:745/235] sm:h-11"
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
          </Link>

          <div className="flex-1 shrink-0" aria-hidden />
        </div>
      </header>

      <Outlet />

      <footer className="ss-footer-bg relative overflow-hidden border-t border-white/[0.06]">
        <div className="relative mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-center gap-4 sm:gap-5">
              <SkillMeterIcon className="h-6 w-6 shrink-0 text-stone-200 opacity-90 sm:h-7 sm:w-7" />
              <div
                aria-hidden
                className="h-8 w-auto shrink-0 bg-stone-200 [aspect-ratio:745/235] sm:h-9"
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
              <SkillMeterIcon className="h-6 w-6 shrink-0 scale-x-[-1] text-stone-200 opacity-90 sm:h-7 sm:w-7" />
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
          <p className="mt-4 max-w-md text-sm text-stone-400">
            Paid draw: skill answers then random winner from correct entries. Free postal entry is in the same Legacy
            Bundle panel as paid tickets. Separate 35 Kick-Ups giveaway. UK-focused.
          </p>
          <p className="mt-6 text-center">
            <span className="inline-block rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-200/90">
              Stripe &amp; PayPal
            </span>
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
