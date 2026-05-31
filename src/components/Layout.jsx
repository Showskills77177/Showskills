import { Link, NavLink, Outlet } from 'react-router-dom'
import showskillsLogo from '../assets/showskills-logo.png'
import { EntryModal } from './EntryModal'
import { TermsModal } from './TermsModal'
import { UK_AVAILABILITY_NOTICE } from '../../shared/siteAvailability.mjs'
import { POSTAL_ENTRY_ADDRESS, FOOTER_NO_PURCHASE_NOTICE } from '../competitionData'
import { MobileNavDock } from './MobileNavDock'
import { QuizPromptNav } from './QuizPromptNav'
import { TrustpilotReviewCollector } from './TrustpilotFeedback'
import { useEntryFlow } from '../entry/entryContext'

function desktopNavClass({ isActive }) {
  return `ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white transition ${
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
  const { termsOpen, setTermsOpen, openTerms, paidQuizNavStatus } = useEntryFlow()
  const showQuizPrompt = paidQuizNavStatus !== 'none'

  return (
    <div className="ss-page-bg min-h-svh font-sans text-stone-300 antialiased">
      <EntryModal />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      <header className="ss-header sticky top-0 z-40 border-b border-white/[0.06] bg-[#071512]/90 backdrop-blur-md">
        {/* Mobile: logo, then menu dock with its own footer strip */}
        <div className="overflow-visible sm:hidden">
          <div className="ss-mobile-logo-row mx-auto flex w-full max-w-5xl justify-center px-4 pb-1 pt-3">
            <Link
              to="/"
              className="outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
              aria-label="ShowSkills Rewards home"
            >
              <LogoMark className="ss-mobile-header-logo h-11" />
            </Link>
          </div>
          {showQuizPrompt ? (
            <div className="flex justify-center px-4 pb-2 sm:hidden">
              <QuizPromptNav className="w-full max-w-xs" />
            </div>
          ) : null}
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
            <NavLink to="/faq" className={desktopNavClass}>
              FAQ
            </NavLink>
            <span className="select-none text-stone-600" aria-hidden>
              —
            </span>
            <button
              type="button"
              onClick={() => openTerms()}
              className="ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white opacity-90 transition hover:opacity-100"
            >
              T&amp;C
            </button>
            {showQuizPrompt ? (
              <>
                <span className="select-none text-stone-600" aria-hidden>
                  —
                </span>
                <QuizPromptNav />
              </>
            ) : null}
          </nav>

          <Link
            to="/"
            className="flex shrink-0 items-center justify-self-center outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
            aria-label="ShowSkills Rewards home"
          >
            <LogoMark />
          </Link>

          <p className="justify-self-end -rotate-2 font-display text-lg font-bold tracking-[0.04em] text-white opacity-95">
            Prizes that matter
          </p>
        </div>
      </header>

      <Outlet />

      <footer className="ss-footer-bg relative overflow-hidden border-t border-white/[0.06]">
        <div className="relative mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-col items-center gap-3">
            <LogoMark className="h-7 sm:h-8" />
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
              <Link
                to="/competitions"
                className="font-medium text-stone-400 underline decoration-stone-600 underline-offset-2 hover:text-stone-200"
              >
                Competitions
              </Link>
              <Link
                to="/contact"
                className="font-medium text-stone-400 underline decoration-stone-600 underline-offset-2 hover:text-stone-200"
              >
                Contact
              </Link>
              <Link
                to="/faq"
                className="font-medium text-stone-400 underline decoration-stone-600 underline-offset-2 hover:text-stone-200"
                title="Frequently asked questions about ShowSkills Rewards"
              >
                FAQ
              </Link>
              <button
                type="button"
                onClick={() => openTerms()}
                className="font-medium text-stone-400 underline decoration-stone-600 underline-offset-2 hover:text-stone-200"
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
                className="text-xs font-medium text-stone-500 underline decoration-stone-700 underline-offset-2 hover:text-stone-300"
              >
                Paid ticket terms
              </button>
            </nav>
          </div>
          <p className="mx-auto mt-3 max-w-2xl text-center text-xs leading-relaxed text-stone-400">
            {FOOTER_NO_PURCHASE_NOTICE}
          </p>
          <p className="mx-auto mt-2 max-w-lg text-center text-xs leading-snug text-stone-500">
            Skill-based paid draw — winner picked at random from correct entries only. Free postal entry — post to{' '}
            {POSTAL_ENTRY_ADDRESS}. {UK_AVAILABILITY_NOTICE}
          </p>
          <div className="mx-auto mt-4 w-full max-w-[12.75rem]">
            <p className="mb-1 text-center text-[10px] font-medium text-stone-600">Trustpilot feedback</p>
            <TrustpilotReviewCollector centered compact />
          </div>
          <p className="mt-5 border-t border-white/[0.06] pt-4 text-center text-[11px] leading-snug text-stone-600">
            Not a lottery. Not affiliated with any athlete, club, or brand in prize imagery.
          </p>
        </div>
      </footer>
    </div>
  )
}
