import { useState } from 'react'
import { apiUrl } from '../lib/api'

/**
 * Optional email capture after a failed World Cup Ball quiz attempt.
 * @param {{ sessionId: string, className?: string, onSaved?: (email: string) => void, alreadySaved?: boolean }} props
 */
export function WorldCupBallFailedContactForm({ sessionId, className = '', onSaved, alreadySaved = false }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(alreadySaved)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!sessionId || saving || saved) return
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch(apiUrl('/api/submissions/world-cup-ball/failed-contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId, email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save your email.')
        return
      }
      setSaved(true)
      onSaved?.(data.email || trimmed)
    } catch {
      setError('Could not save your email. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!sessionId) return null

  if (saved) {
    return (
      <div
        className={`mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-4 py-3 text-sm text-emerald-50/95 ${className}`.trim()}
      >
        <p className="font-semibold text-emerald-100">Email saved</p>
        <p className="mt-1 text-stone-300">
          We will use this address if we need to contact you about the monthly draw or your attempt.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`mt-4 rounded-xl border border-stone-600/40 bg-stone-950/50 px-4 py-4 ${className}`.trim()}
    >
      <p className="text-sm font-semibold text-stone-100">Leave your email (optional)</p>
      <p className="mt-1 text-xs leading-relaxed text-stone-400">
        If you entered the free monthly draw, we can contact you if you win. We will not use your email for
        marketing without consent.
      </p>
      <label className="mt-3 block text-xs font-medium text-stone-400">
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-stone-100"
        />
      </label>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={saving || !email.trim()}
        className="mt-3 w-full rounded-lg border border-amber-500/35 bg-amber-950/40 py-2.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save email'}
      </button>
    </form>
  )
}
