import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { apiFetch } from '../lib/api'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

function parseApiError(data, fallback) {
  return typeof data?.error === 'string' ? data.error : fallback
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { refresh } = useUserAuth()
  const { t } = useSiteLocale()
  const from = typeof location.state?.from === 'string' ? location.state.from : '/account'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(parseApiError(data, t('auth.invalidCredentials')))
        return
      }
      await refresh()
      navigate(from, { replace: true })
    } catch {
      setError(t('form.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ss-photo-page relative m-0 overflow-x-clip p-0">
      <PhotoPageBackdrop />
      <div className="relative z-[1] mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="font-display text-3xl uppercase tracking-[0.08em] text-white sm:text-4xl">
          {t('auth.loginTitle')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-400">{t('auth.loginIntro')}</p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-lime-500/25 bg-lime-950/20 p-5 sm:p-6"
        >
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-sm text-stone-300">{t('common.email')}</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('common.emailPlaceholder')}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-lime-500/50"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-stone-300">{t('auth.password')}</span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 pr-20 text-white outline-none focus:border-lime-500/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-stone-400 hover:text-white"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
          >
            {loading ? t('auth.signingIn') : t('auth.signIn')}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-500">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300">
            {t('auth.createOne')}
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
