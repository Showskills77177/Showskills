import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { apiFetch } from '../lib/api'
import { DEFAULT_NEWSLETTER_PREFERENCES } from '../../shared/newsletter.mjs'

export default function NewsletterPreferencesPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [active, setActive] = useState(true)
  const [prefs, setPrefs] = useState({ ...DEFAULT_NEWSLETTER_PREFERENCES })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Missing link token. Use the link from your newsletter email.')
      return
    }
    let cancelled = false
    apiFetch(`/api/newsletter/preferences?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Could not load preferences')
        if (cancelled) return
        setEmail(data.subscriber?.email || '')
        setActive(data.subscriber?.active !== false)
        setPrefs(data.subscriber?.preferences || { ...DEFAULT_NEWSLETTER_PREFERENCES })
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

  async function onSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const res = await apiFetch('/api/newsletter/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, preferences: prefs }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setActive(data.subscriber?.active !== false)
      setMessage('Your preferences were saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] text-white">Email preferences</h1>
        {loading ? <p className="mt-4 text-sm text-stone-500">Loading…</p> : null}
        {error ? (
          <p className="mt-4 text-sm text-red-300/90" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && token ? (
          <form onSubmit={onSave} className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/25 p-5">
            <p className="text-sm text-stone-400">
              Managing preferences for <strong className="text-stone-200">{email}</strong>
              {!active ? ' (currently unsubscribed — saving will re-subscribe you)' : null}
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={prefs.giveawayUpdates}
                onChange={(e) => setPrefs((p) => ({ ...p, giveawayUpdates: e.target.checked }))}
              />
              <span>Free giveaway updates (e.g. Ronaldo shirt draw)</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={prefs.competitionNews}
                onChange={(e) => setPrefs((p) => ({ ...p, competitionNews: e.target.checked }))}
              />
              <span>Prize draw competitions and ticket news</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-stone-300">
              <input
                type="checkbox"
                className="mt-1"
                checked={prefs.promotions}
                onChange={(e) => setPrefs((p) => ({ ...p, promotions: e.target.checked }))}
              />
              <span>Promotions and partner offers</span>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
            {message ? <p className="text-sm text-emerald-300/90">{message}</p> : null}
            <p className="text-center text-sm">
              <Link
                to={`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`}
                className="text-stone-500 underline underline-offset-2 hover:text-stone-300"
              >
                Unsubscribe from all emails
              </Link>
            </p>
          </form>
        ) : null}
        <p className="mt-8 text-sm text-stone-500">
          <Link to="/" className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  )
}
