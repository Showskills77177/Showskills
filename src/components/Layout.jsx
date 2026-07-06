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
import { resolveSiteShellRootClassName } from '../../shared/siteShellPresentation.mjs'
import { translateNavLabel } from '../../shared/i18n/translate.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { localizedLayoutTextOrCms } from '../../shared/i18n/localizedLayout.mjs'
import { LanguagePicker } from './LanguagePicker'
import { RegionNoticeBanner } from './RegionNoticeBanner'
import { HeaderAccountLinks } from './HeaderAccountLinks'

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

function DesktopNavLink({ item, openTerms, locale }) {
  if (item.visible === false) return null
  const label = translateNavLabel(locale, item)
  if (item.action === 'terms') {
    return (
      <button
        type="button"
        onClick={() => openTerms()}
        className="ss-desktop-nav-link rounded-md px-1.5 py-1 text-sm text-white opacity-90 transition hover:opacity-100"
      >
        {label}
      </button>
    )
  }
  return (
    <NavLink to={item.path || '/'} end={item.path === '/'} className={desktopNavClass}>
      {label}
    </NavLink>
  )
}

export function Layout() {
  const { termsOpen, setTermsOpen, openTerms, paidQuizNavStatus } = useEntryFlow()
  const { shell } = useSiteShell()
  const { locale, t } = useSiteLocale()
  const headerTagline = localizedLayoutTextOrCms(locale, t, 'layout.shell.tagline', shell.headerTagline)
  const showQuizPrompt = paidQuizNavStatus !== 'none'
  const rootClassName = resolveSiteShellRootClassName(shell)
  const navItems = shell.navOrder
    .map((id) => shell.navItems[id])
    .filter(Boolean)
    .filter((item) => item.visible !== false)
  const footerLinks = (shell.footer?.linkOrder || [])
    .map((id) => {
      const link = shell.footer?.links?.[id]
      return link ? { ...link, id } : null
    })
    .filter(Boolean)
  const headerOffsets = shell.headerOffsets || {}

  function withOffset(offsets, key, node) {
    const style = offsetStyle(offsets?.[key], { scale: 1, widthOnly: true })
    return style ? <div style={style}>{node}</div> : node
  }

  return (
    <div className={rootClassName}>
      <EntryModal />
      <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)} />
      <RegionNoticeBanner />

      <header className="ss-header sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-md">
        <div className="overflow-visible sm:hidden">
          <div className="ss-mobile-logo-row mx-auto flex w-full max-w-5xl justify-center px-4 pb-1.5 pt-3.5">
            <Link
              to="/"
              className="outline-none focus-visible:ring-2 focus-visible:ring-lime-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071512]"
              aria-label="ShowSkills Rewards home"
            >
              <LogoMark className="ss-mobile-header-logo h-12" />
            </Link>
          </div>
          {showQuizPrompt ? (
            <div className="flex justify-center gap-2 px-4 pb-2 sm:hidden">
              <LanguagePicker />
              <QuizPromptNav className="w-full max-w-xs" />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 pb-2 sm:hidden">
              <HeaderAccountLinks />
              <LanguagePicker />
            </div>
          )}
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
                    <DesktopNavLink item={item} openTerms={openTerms} locale={locale} />
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

          {shell.showHeaderTagline !== false && headerTagline
            ? withOffset(
                headerOffsets,
                'tagline',
                <div className="flex items-center justify-end gap-3 justify-self-end">
                  <HeaderAccountLinks className="hidden sm:flex" />
                  <LanguagePicker className="hidden md:inline-flex" />
                  <p className="hidden -rotate-2 font-display text-lg font-bold tracking-[0.04em] text-white opacity-95 md:block">
                    {headerTagline}
                  </p>
                </div>,
              )
            : withOffset(
                headerOffsets,
                'tagline',
                <div className="hidden items-center justify-end gap-3 justify-self-end md:flex">
                  <HeaderAccountLinks />
                  <LanguagePicker />
                </div>,
              )}
        </div>
      </header>

      <Outlet />

      <SiteFooter shell={shell} footerLinks={footerLinks} openTerms={openTerms} />
    </div>
  )
}
