import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'

/**
 * Home-page editor login — bypasses VPN + one-IP quiz limits on test/staging.
 * Hidden automatically on live showskills.co.uk production.
 */
export function EditorTestLogin() {
  const [enabled, setEnabled] = useState(false)
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
      if (!data.enabled) {
        setEnabled(false)
        setLoggedIn(false)
        return
      }
      setEnabled(true)
      setLoggedIn(Boolean(data.loggedIn))
      setUser(typeof data.user === 'string' ? data.user : '')
    } catch {
      setEnabled(false)
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

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex max-w-[min(100vw-2rem,20rem)] flex-col items-end gap-2">
      {loggedIn ? (
        <div className="pointer-events-auto rounded-xl border border-emerald-500/40 bg-stone-950/95 px-3 py-2.5 text-xs text-stone-200 shadow-xl backdrop-blur-sm">
          <p className="font-semibold text-emerald-200">Editor test mode</p>
          <p className="mt-1 leading-relaxed text-stone-400">
            Signed in as <span className="text-stone-200">{user}</span>. VPN and one-attempt IP limits are off — retake
            the World Cup Ball quiz freely.
          </p>
          <button
            type="button"
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
        >
          <p className="text-xs font-semibold text-amber-100">Editor quiz test login</p>
          <p className="mt-1 text-[11px] leading-relaxed text-stone-500">For editors only — bypasses VPN and IP limits.</p>
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
              disabled={loading}
              className="flex-1 rounded-lg bg-amber-600 py-1.5 text-xs font-bold text-stone-950 disabled:opacity-50"
            >
              Sign in
            </button>
            <button
              type="button"
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
          onClick={() => setOpen(true)}
          className="pointer-events-auto rounded-full border border-stone-600/80 bg-stone-950/90 px-3 py-2 text-[11px] font-semibold text-stone-300 shadow-lg backdrop-blur-sm transition hover:border-amber-500/50 hover:text-amber-100"
        >
          Editor test login
        </button>
      )}
    </div>
  )
}
