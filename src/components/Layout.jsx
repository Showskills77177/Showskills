import { Link, NavLink, Outlet } from 'react-router-dom'
import showskillsLogo from '../assets/showskills-logo.png'
import { EntryModal } from './EntryModal'
import { TermsModal } from './TermsModal'
import { MobileNavDock } from './MobileNavDock'
import { QuizPromptNav } from './QuizPromptNav'
import { useEntryFlow } from '../entry/entryContext'
import { useSiteShell } from '../hooks/useSitePages'
import { SiteFooter } from './SiteFooter'
import { offsetStyle } from '../../shared/layoutOffsets.mjs'
import { SITE_PAGE_BACKGROUNDS } from '../../shared/sitePageLayout.mjs'

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

function DesktopNavLink({ item, openTerms }) {
  if (item.visible === false) return null
  if (item.action === 'terms') {
    return (
      <button
        type="button"
        onClick={() => openTerms()}
        className="ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white opacity-90 transition hover:opacity-100"
      >
        {item.label}
      </button>
    )
  }
  return (
    <NavLink to={item.path || '/'} end={item.path === '/'} className={desktopNavClass}>
      {item.label}
    </NavLink>
  )
}

export function Layout() {
  const { termsOpen, setTermsOpen, openTerms, paidQuizNavStatus } = useEntryFlow()
  const { shell } = useSiteShell()
  const showQuizPrompt = paidQuizNavStatus !== 'none'
  const pageBgClass =
    shell.pageBackground === SITE_PAGE_BACKGROUNDS.solid ? 'bg-[#071512]' : 'ss-page-bg'
  const navItems = shell.navOrder
    .map((id) => shell.navItems[id])
    .filter(Boolean)
    .filter((item) => item.visible !== false)
  const footerLinks = (shell.footer?.linkOrder || [])
    .map((id) => shell.footer?.links?.[id])
    .filter(Boolean)
  const headerOffsets = shell.headerOffsets || {}

  function withOffset(offsets, key, node) {
    const style = offsetStyle(offsets?.[key], { scale: 1, widthOnly: true })
    return style ? <div style={style}>{node}</div> : node
  }

  return (
    <div className={`${pageBgClass} min-h-svh font-sans text-stone-300 antialiased`}>
      <EntryModal />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />

      <header className="ss-header sticky top-0 z-40 border-b border-white/[0.06] bg-[#071512]/90 backdrop-blur-md">
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
          <MobileNavDock navItems={navItems} />
        </div>

        <div className="relative z-10 mx-auto hidden max-w-5xl min-h-[4rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-y-0 px-6 py-2.5 sm:grid">
          <nav
            className="flex flex-wrap items-center justify-start gap-x-1 text-sm leading-normal"
            aria-label="Main navigation"
          >
            {withOffset(
              headerOffsets,
              'nav',
              <>
                {navItems.map((item, i) => (
                  <span key={item.id} className="contents">
                    {i > 0 ? (
                      <span className="select-none text-stone-600" aria-hidden>
                        —
                      </span>
                    ) : null}
                    <DesktopNavLink item={item} openTerms={openTerms} />
                  </span>
                ))}
                {showQuizPrompt ? (
                  <>
                    <span className="select-none text-stone-600" aria-hidden>
                      —
                    </span>
                    <QuizPromptNav />
                  </>
                ) : null}
              </>,
            )}
          </nav>

          {withOffset(
            headerOffsets,
            'logo',
            <Link
              to="/"
              className="flex shrink-0 items-center justify-self-center outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
              aria-label="ShowSkills Rewards home"
            >
              <LogoMark />
            </Link>,
          )}

          {shell.showHeaderTagline !== false && shell.headerTagline
            ? withOffset(
                headerOffsets,
                'tagline',
                <p className="hidden justify-self-end -rotate-2 font-display text-lg font-bold tracking-[0.04em] text-white opacity-95 md:block">
                  {shell.headerTagline}
                </p>,
              )
            : (
              <span aria-hidden />
            )}
        </div>
      </header>

      <Outlet />

      <SiteFooter shell={shell} footerLinks={footerLinks} openTerms={openTerms} />
    </div>
  )
}
