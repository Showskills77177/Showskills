import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '../../lib/api'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = typeof location.state?.from === 'string' ? location.state.from : '/admin/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const text = await res.text()
      let data = {}
      try {
        data = text ? JSON.parse(text) : {}
      } catch {
        /* non-JSON (e.g. HTML error from proxy) */
      }
      if (!res.ok) {
        const apiMsg =
          typeof data.error === 'string'
            ? data.error
            : typeof data.message === 'string'
              ? data.message
              : ''
        const hint =
          res.status === 502 || res.status === 504 || res.status === 404
            ? ' Run npm run dev:all, or npm run dev:api (node server.js on port 3000).'
            : ''
        setError(
          apiMsg ||
            (text.trim() ? `${res.status}: ${text.trim().slice(0, 160)}` : '') ||
            `Could not reach login API (HTTP ${res.status}).${hint}`,
        )
        return
      }
      navigate(from.startsWith('/admin') ? from : '/admin/dashboard', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(
        `Network error (${msg}). Use http://localhost:5173 (not 127.0.0.1), run npm run dev + npm run dev:api, and remove VITE_API_BASE from .env unless you know you need it.`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-stone-900/80 p-8 shadow-xl">
        <h1 className="text-center text-lg font-semibold text-stone-100">Admin sign in</h1>
        <p className="mt-2 text-center text-xs text-stone-500">This area is not linked from the public site.</p>
        <p className="mt-2 text-center text-[11px] leading-snug text-stone-600">
          <strong className="font-medium text-stone-500">Local dev:</strong> run{' '}
          <code className="text-stone-500">npm run dev:all</code> (Express API on :3000 + Vite), or{' '}
          <code className="text-stone-500">npm run dev:api</code> then <code className="text-stone-500">npm run dev</code>.
        </p>
        <form className="mt-6 flex flex-col gap-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="admin-user" className="block text-xs font-medium text-stone-400">
              Username
            </label>
            <input
              id="admin-user"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
            />
          </div>
          <div>
            <label htmlFor="admin-pass" className="block text-xs font-medium text-stone-400">
              Password
            </label>
            <input
              id="admin-pass"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-stone-200 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-stone-400 select-none">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-white/25 bg-black/40 text-teal-600 focus:ring-teal-900/40"
              />
              Show password
            </label>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
