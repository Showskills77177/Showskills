import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import { useEntryFlow } from '../entry/entryContext'

function isLikelyTestHost() {
  if (import.meta.env.DEV) return true
  const host = window.location.hostname.toLowerCase()
  return host.includes('localhost') || host.includes('vercelshowskillstesteasynow')
}

/**
 * Site-wide editor login — bypasses VPN + one-IP World Cup Ball limits on test/staging.
 * Hidden on live showskills.co.uk production.
 */
export function EditorTestLogin() {
  const { resetWorldCupBallQuizAttempt } = useEntryFlow()
  const [enabled, setEnabled] = useState(isLikelyTestHost())
  const [loggedIn, setLoggedIn] = useState(false)
  const [user, setUser] = useState('')
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('ruslan')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/editor-test-me')
      const data = await res.json().catch(() => ({}))
      if (data.enabled === false) {
        setEnabled(false)
        setLoggedIn(false)
        return
      }
      if (data.enabled === true || isLikelyTestHost()) {
        setEnabled(true)
        setLoggedIn(Boolean(data.loggedIn))
        setUser(typeof data.user === 'string' ? data.user : '')
      }
    } catch {
      if (!isLikelyTestHost()) setEnabled(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!enabled) return null

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/editor-test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Login failed')
        return
      }
      setPassword('')
      setOpen(false)
      await refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      await apiFetch('/api/editor-test-logout', { method: 'POST' })
      await refresh()
    } finally {
      setLoading(false)
    }
  }

  const handleRestartQuiz = () => {
    resetWorldCupBallQuizAttempt({ openModal: true })
  }

  return (
    <div
      className="pointer-events-none fixed bottom-20 right-3 z-[9999] flex max-w-[min(100vw-1.5rem,20rem)] flex-col items-end gap-2 sm:bottom-4 sm:right-4"
      data-editor-ui
    >
      {loggedIn ? (
        <div className="pointer-events-auto rounded-xl border border-emerald-500/40 bg-stone-950/95 px-3 py-2.5 text-xs text-stone-200 shadow-xl backdrop-blur-sm">
          <p className="font-semibold text-emerald-200">Editor test mode</p>
          <p className="mt-1 leading-relaxed text-stone-400">
            Signed in as <span className="text-stone-200">{user}</span>. VPN and one-attempt IP limits are off —
            retake the World Cup Ball quiz freely.
          </p>
          <button
            type="button"
            data-editor-ui
            onClick={handleRestartQuiz}
            className="mt-2 w-full rounded-lg bg-emerald-700/90 py-1.5 text-[11px] font-bold text-emerald-50 transition hover:bg-emerald-600 disabled:opacity-50"
          >
            Restart World Cup Ball quiz
          </button>
          <button
            type="button"
            data-editor-ui
            onClick={() => void handleLogout()}
            disabled={loading}
            className="mt-2 rounded-lg border border-stone-600 px-2.5 py-1 text-[11px] font-semibold text-stone-300 transition hover:border-stone-400 hover:text-white disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      ) : open ? (
        <form
          onSubmit={(e) => void handleLogin(e)}
          className="pointer-events-auto w-full rounded-xl border border-amber-500/35 bg-stone-950/95 p-3 shadow-xl backdrop-blur-sm"
          data-editor-ui
        >
          <p className="text-xs font-semibold text-amber-100">Editor quiz test login</p>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
            For editors only — bypasses VPN and IP limits.
          </p>
          <label className="mt-2 block text-[11px] text-stone-400">
            Username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1.5 text-sm text-stone-100"
            />
          </label>
          <label className="mt-2 block text-[11px] text-stone-400">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-900 px-2.5 py-1.5 text-sm text-stone-100"
            />
          </label>
          {error ? (
            <p className="mt-2 text-[11px] text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              data-editor-ui
              disabled={loading}
              className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-bold text-stone-950 disabled:opacity-50"
            >
              Sign in
            </button>
            <button
              type="button"
              data-editor-ui
              onClick={() => setOpen(false)}
              className="rounded-lg border border-stone-700 px-2.5 py-1.5 text-xs text-stone-400"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          data-editor-ui
          onClick={() => setOpen(true)}
          className="pointer-events-auto rounded-full border border-amber-500/50 bg-stone-950/95 px-3 py-2 text-[11px] font-semibold text-amber-100 shadow-lg backdrop-blur-sm transition hover:border-amber-400 hover:bg-stone-900"
        >
          Editor test login
        </button>
      )}
    </div>
  )
}
