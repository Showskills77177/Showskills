import { useState } from 'react'
import { apiFetch } from '../lib/api'
import { NEWSLETTER_SOURCES } from '../../shared/newsletter.mjs'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

/** Compact email signup — footer, newsletter page, etc. */
export function NewsletterSignupForm({
  source = NEWSLETTER_SOURCES.footer,
  className = '',
  compact = false,
  /** @type {'default' | 'footer'} */ variant = 'default',
  inputId = 'newsletter-email',
}) {
  const isFooter = variant === 'footer' || compact
  const { t } = useSiteLocale()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    const em = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError(t('form.invalidEmail'))
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          data.error ||
            (res.status === 404 ? t('newsletter.unavailable') : t('newsletter.failed')),
        )
      }
      setMessage(data.message || t('newsletter.subscribed'))
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('newsletter.subscriptionFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`ss-newsletter-signup w-full ${className}`}
      aria-label={t('newsletter.ariaLabel')}
    >
      <p
        className={
          isFooter
            ? 'text-center text-base leading-snug text-stone-400 md:text-sm'
            : compact
              ? 'text-sm text-stone-500 md:text-xs'
              : 'text-base text-stone-400 md:text-sm'
        }
      >
        {isFooter ? t('newsletter.footerLead') : t('newsletter.pageLead')}
      </p>
      <div
        className={
          isFooter
            ? 'mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-stretch'
            : `mt-2 flex flex-col gap-2 ${compact ? 'sm:flex-row' : 'sm:flex-row sm:items-stretch'}`
        }
      >
        <label className="sr-only" htmlFor={inputId}>
          {t('common.email')}
        </label>
        <input
          id={inputId}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('common.emailPlaceholder')}
          className="min-h-[2.75rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-base text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40 sm:min-h-[2.75rem]"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[2.75rem] shrink-0 rounded-lg bg-gradient-to-r from-lime-700 to-emerald-700 px-5 py-2 text-base font-bold text-white transition hover:brightness-110 disabled:opacity-50 sm:min-h-[2.75rem] md:text-sm"
        >
          {loading ? t('common.joining') : t('common.subscribe')}
        </button>
      </div>
      {error ? (
        <p className="mt-2 text-center text-sm text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-center text-sm text-emerald-300/90" role="status">
          {message}
        </p>
      ) : null}
    </form>
  )
}
