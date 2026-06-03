import { useState } from 'react'
import { apiFetch } from '../lib/api'
import { NEWSLETTER_SOURCES } from '../../shared/newsletter.mjs'

/** Compact email signup — footer, newsletter page, etc. */
export function NewsletterSignupForm({
  source = NEWSLETTER_SOURCES.footer,
  className = '',
  compact = false,
  /** @type {'default' | 'footer'} */ variant = 'default',
  inputId = 'newsletter-email',
}) {
  const isFooter = variant === 'footer' || compact
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
      setError('Enter a valid email address.')
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
            (res.status === 404
              ? 'Newsletter signup is not available right now. Please try again in a few minutes.'
              : 'Could not subscribe'),
        )
      }
      setMessage(data.message || 'You are subscribed. Check your inbox for updates.')
      setEmail('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`ss-newsletter-signup w-full ${className}`}
      aria-label="Newsletter signup"
    >
      <p
        className={
          isFooter
            ? 'text-center text-sm leading-snug text-stone-400'
            : compact
              ? 'text-xs text-stone-500'
              : 'text-sm text-stone-400'
        }
      >
        {isFooter ? (
          <>
            Join <strong className="font-semibold text-stone-200">ShowSkills Rewards</strong> for giveaway and
            competition news.
          </>
        ) : (
          <>
            Join <strong className="font-semibold text-stone-300">ShowSkills Rewards</strong> for giveaway and
            competition news. No account needed.
          </>
        )}
      </p>
      <div
        className={
          isFooter
            ? 'mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-stretch'
            : `mt-2 flex flex-col gap-2 ${compact ? 'sm:flex-row' : 'sm:flex-row sm:items-stretch'}`
        }
      >
        <label className="sr-only" htmlFor={inputId}>
          Email
        </label>
        <input
          id={inputId}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="min-h-[2.5rem] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-stone-200 placeholder:text-stone-600 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-900/40 sm:min-h-[2.75rem] sm:text-base"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="min-h-[2.5rem] shrink-0 rounded-lg bg-gradient-to-r from-lime-700 to-emerald-700 px-5 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-50 sm:min-h-[2.75rem]"
        >
          {loading ? 'Joining…' : 'Subscribe'}
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
