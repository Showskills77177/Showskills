import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { apiFetch } from '../lib/api'

export default function NewsletterUnsubscribePage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [loading, setLoading] = useState(Boolean(token))
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('Missing unsubscribe link. Use the link from your newsletter email.')
      return
    }
    let cancelled = false
    apiFetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, { method: 'GET' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Unsubscribe failed')
        if (cancelled) return
        setEmail(data.email || '')
        setMessage(data.message || 'You have been unsubscribed.')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] text-white">Unsubscribe</h1>
        {loading ? <p className="mt-4 text-sm text-stone-500">Processing…</p> : null}
        {error ? (
          <p className="mt-4 text-sm text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-stone-300">
            {message}
            {email ? (
              <>
                {' '}
                (<span className="text-stone-400">{email}</span>)
              </>
            ) : null}
          </p>
        ) : null}
        <p className="mt-8 text-sm text-stone-500">
          Changed your mind?{' '}
          <Link to="/newsletter" className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300">
            Subscribe again
          </Link>{' '}
          or{' '}
          {token ? (
            <Link
              to={`/newsletter/preferences?token=${encodeURIComponent(token)}`}
              className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300"
            >
              update preferences
            </Link>
          ) : (
            'contact us'
          )}
          .
        </p>
        <p className="mt-4 text-sm text-stone-500">
          <Link to="/" className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
