import { Link } from 'react-router-dom'
import showskillsLogo from '../assets/showskills-logo.png'
import { POSTAL_ENTRY_ADDRESS } from '../competitionData'
import { FooterSocialLinks } from './FooterSocialLinks'
import { NewsletterSignupForm } from './NewsletterSignupForm'
import { TrustpilotReviewCollector } from './TrustpilotFeedback'
import { NEWSLETTER_SOURCES } from '../../shared/newsletter.mjs'
import { offsetStyle } from '../../shared/layoutOffsets.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'
import { translateFooterLabel } from '../../shared/i18n/translate.mjs'
import { localizedLayoutTextOrCms } from '../../shared/i18n/localizedLayout.mjs'
import { SHOWSKILLS_POSITIONING_STATEMENT } from '../../shared/sitePositioning.mjs'

function LogoMark({ className = 'h-7 sm:h-8' }) {
  return (
    <div
      role="img"
      aria-label="ShowSkills Rewards"
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

function FooterNavLink({ link, openTerms, locale }) {
  if (link.visible === false) return null
  const label = translateFooterLabel(locale, link)
  const className =
    'text-base font-medium text-stone-400 transition hover:text-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-400/50 md:text-sm'

  if (link.action === 'terms') {
    return (
      <button type="button" onClick={() => openTerms()} className={className}>
        {label}
      </button>
    )
  }
  if (link.action === 'ticketTerms') {
    return (
      <button
        type="button"
        onClick={() => {
          openTerms()
          window.setTimeout(() => {
            document.getElementById('ss-terms-ticket-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 200)
        }}
        className={className}
      >
        {label}
      </button>
    )
  }
  return (
    <Link to={link.path || '/'} className={className} title={label}>
      {label}
    </Link>
  )
}

function withOffset(offsets, key, node) {
  const style = offsetStyle(offsets?.[key], { scale: 1, widthOnly: true })
  return style ? <div style={style}>{node}</div> : node
}

/**
 * @param {{
 *   shell: object,
 *   footerLinks: object[],
 *   openTerms: () => void,
 * }} props
 */
export function SiteFooter({ shell, footerLinks, openTerms }) {
  if (shell.footer?.visible === false) return null

  const { locale, t, region } = useSiteLocale()
  const footerOffsets = shell.footerOffsets || {}
  const footerSocial = shell.footer?.socialLinks || {}
  const legalMain =
    shell.footer?.legalNotice?.trim() ||
    t('legal.footerNoPurchase')
  const disclaimer =
    localizedLayoutTextOrCms(locale, t, 'layout.shell.disclaimer', shell.footer?.disclaimer) ||
    shell.footer?.disclaimer

  return (
    <footer className="ss-footer-bg border-t border-white/[0.06]">
      <div className="ss-site-container flex flex-col items-center px-4 py-5 text-center sm:px-6 sm:py-6">
        {shell.footer?.showLogo !== false
          ? withOffset(footerOffsets, 'logo', <LogoMark />)
          : null}

        {withOffset(
          footerOffsets,
          'links',
          <nav className="mt-2.5 flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5" aria-label="Footer">
            {footerLinks.map((link) => (
              <FooterNavLink key={link.id || link.label} link={link} openTerms={openTerms} locale={locale} />
            ))}
          </nav>,
        )}

        {shell.footer?.showSocial !== false
          ? withOffset(
              footerOffsets,
              'social',
              <FooterSocialLinks links={footerSocial} className="mt-2.5" />,
            )
          : null}

        <div className="mt-4 w-full max-w-md rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-3 sm:px-4">
          <NewsletterSignupForm
            source={NEWSLETTER_SOURCES.footer}
            variant="footer"
            inputId="newsletter-email-footer"
          />
        </div>

        <div className="mt-4 max-w-2xl space-y-1.5">
          <p className="text-sm leading-relaxed text-stone-400 sm:text-[13px]">{SHOWSKILLS_POSITIONING_STATEMENT}</p>
          {withOffset(
            footerOffsets,
            'legal',
            <p className="text-sm leading-relaxed text-stone-400 sm:text-[13px]">{legalMain}</p>,
          )}
          <p className="text-sm leading-relaxed text-stone-500 sm:text-[13px]">
            {region.paidBundlesAvailable
              ? `${t('footer.paidUkOnly')} ${POSTAL_ENTRY_ADDRESS}`
              : t('footer.giveawaysInternational')}
          </p>
        </div>

        {shell.footer?.showTrustpilot !== false ? (
          <div className="mt-3 w-full max-w-[13rem]">
            <TrustpilotReviewCollector centered compact />
          </div>
        ) : null}

        {disclaimer
          ? withOffset(
              footerOffsets,
              'disclaimer',
              <p className="mt-3 max-w-2xl border-t border-white/[0.06] pt-3 text-sm leading-relaxed text-stone-500 md:text-xs">
                {disclaimer}
              </p>,
            )
          : null}
      </div>
    </footer>
  )
}
