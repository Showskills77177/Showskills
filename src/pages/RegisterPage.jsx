import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PhotoPageBackdrop } from '../components/PhotoPageBackdrop'
import { apiFetch } from '../lib/api'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

function parseApiError(data, fallback) {
  return typeof data?.error === 'string' ? data.error : fallback
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { refresh } = useUserAuth()
  const { t } = useSiteLocale()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(parseApiError(data, t('form.networkError')))
        return
      }
      await refresh()
      navigate('/account', { replace: true })
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
          {t('auth.registerTitle')}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-stone-400">{t('auth.registerIntro')}</p>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-2xl border border-lime-500/25 bg-lime-950/20 p-5 sm:p-6"
        >
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </p>
          ) : null}

          <p className="rounded-lg border border-teal-500/20 bg-teal-950/20 px-3 py-2 text-sm leading-relaxed text-teal-100/90">
            {t('auth.registerNewsletterNote')}
          </p>

          <label className="block">
            <span className="mb-1 block text-sm text-stone-300">{t('auth.fullName')}</span>
            <input
              type="text"
              autoComplete="name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('auth.fullNamePlaceholder')}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-lime-500/50"
            />
          </label>

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
                autoComplete="new-password"
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
            <span className="mt-1 block text-xs text-stone-500">{t('auth.passwordHint')}</span>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-stone-300">{t('auth.confirmPassword')}</span>
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-lime-500/50"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
          >
            {loading ? t('auth.creatingAccount') : t('auth.register')}
          </button>
        </form>

        <p className="mt-6 text-sm text-stone-500">
          {t('auth.hasAccount')}{' '}
          <Link to="/login" className="text-teal-400/90 underline underline-offset-2 hover:text-teal-300">
            {t('auth.signIn')}
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
