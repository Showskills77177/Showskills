import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ModalPortal } from './ModalPortal'
import { apiFetch } from '../lib/api'
import { useUserAuth } from '../auth/UserAuthProvider'
import { useSiteLocale } from '../i18n/SiteLocaleProvider.jsx'

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white outline-none focus:border-lime-500/50'

function parseApiError(data, fallback, status) {
  if (typeof data?.error === 'string') return data.error
  if (status === 404) return 'Account service is temporarily unavailable. Please try again shortly.'
  if (status && status >= 500) return 'Server error. Please try again shortly.'
  return fallback
}

function LoginForm({ onSwitchRegister, onForgotPassword, onSuccess }) {
  const { refresh } = useUserAuth()
  const { t } = useSiteLocale()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
        setError(parseApiError(data, t('auth.invalidCredentials'), res.status))
        return
      }
      await refresh()
      onSuccess()
    } catch {
      setError(t('form.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-stone-400">{t('auth.loginIntro')}</p>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('common.email')}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.password')}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
      >
        {loading ? t('auth.signingIn') : t('auth.signIn')}
      </button>
      <p className="text-center text-sm">
        <button
          type="button"
          onClick={onForgotPassword}
          className="text-lime-300 underline underline-offset-2"
        >
          {t('auth.forgotPassword')}
        </button>
      </p>
      <p className="text-center text-sm text-stone-500">
        {t('auth.noAccount')}{' '}
        <button type="button" onClick={onSwitchRegister} className="text-lime-300 underline underline-offset-2">
          {t('auth.createOne')}
        </button>
      </p>
    </form>
  )
}

function ForgotPasswordForm({ onSwitchLogin, onCodeSent }) {
  const { t } = useSiteLocale()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(parseApiError(data, t('form.networkError'), res.status))
        return
      }
      const message =
        typeof data.message === 'string' ? data.message : t('auth.resetCodeSent')
      setInfo(message)
      if (data.verificationRequired) {
        onCodeSent({ maskedDestination: data.maskedDestination, sandboxNote: data.sandboxNote })
      }
    } catch {
      setError(t('form.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-lime-500/30 bg-lime-950/30 px-3 py-2 text-sm text-lime-200" role="status">
          {info}
        </p>
      ) : null}
      <p className="text-sm text-stone-400">{t('auth.forgotPasswordIntro')}</p>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('common.email')}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
      >
        {loading ? t('auth.sendingResetCode') : t('auth.sendResetCode')}
      </button>
      <p className="text-center text-sm text-stone-500">
        <button type="button" onClick={onSwitchLogin} className="text-lime-300 underline underline-offset-2">
          {t('auth.backToSignIn')}
        </button>
      </p>
    </form>
  )
}

function ResetPasswordForm({ onSwitchLogin, resetMeta }) {
  const { t } = useSiteLocale()
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [resendCooldown])

  async function onResend() {
    if (resendCooldown > 0 || resendLoading) return
    setError('')
    setInfo('')
    setResendLoading(true)
    try {
      const res = await apiFetch('/api/auth/resend-reset-code', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(parseApiError(data, t('form.networkError'), res.status))
        if (res.status === 401) onSwitchLogin()
        return
      }
      setInfo(typeof data.message === 'string' ? data.message : t('auth.resetCodeSent'))
      setResendCooldown(60)
    } catch {
      setError(t('form.networkError'))
    } finally {
      setResendLoading(false)
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'))
      return
    }
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, newPassword, confirmPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(parseApiError(data, t('form.networkError'), res.status))
        if (res.status === 401) onSwitchLogin()
        return
      }
      setInfo(typeof data.message === 'string' ? data.message : t('auth.passwordResetSuccess'))
      onSwitchLogin({ successMessage: typeof data.message === 'string' ? data.message : t('auth.passwordResetSuccess') })
    } catch {
      setError(t('form.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-lime-500/30 bg-lime-950/30 px-3 py-2 text-sm text-lime-200" role="status">
          {info}
        </p>
      ) : null}
      <p className="text-sm text-stone-400">{t('auth.resetPasswordIntro')}</p>
      {resetMeta?.maskedDestination ? (
        <p className="text-xs text-stone-500">
          {t('common.email')}: <span className="text-stone-300">{resetMeta.maskedDestination}</span>
        </p>
      ) : null}
      {resetMeta?.sandboxNote ? (
        <p className="rounded-lg border border-amber-500/25 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/90">
          {resetMeta.sandboxNote}
        </p>
      ) : null}
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.resetCode')}</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className={inputClass}
          placeholder={t('auth.resetCodeHint')}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.newPassword')}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.confirmPassword')}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
      >
        {loading ? t('auth.resettingPassword') : t('auth.resetPassword')}
      </button>
      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          disabled={resendCooldown > 0 || resendLoading}
          onClick={onResend}
          className="text-lime-300 underline underline-offset-2 disabled:cursor-not-allowed disabled:text-stone-600 disabled:no-underline"
        >
          {resendLoading
            ? t('auth.sendingResetCode')
            : resendCooldown > 0
              ? t('auth.resendResetCooldown', { seconds: resendCooldown })
              : t('auth.resendResetCode')}
        </button>
        <button type="button" onClick={() => onSwitchLogin()} className="text-stone-500 underline underline-offset-2">
          {t('auth.backToSignIn')}
        </button>
      </div>
    </form>
  )
}

function RegisterForm({ onSwitchLogin, onForgotPassword, onSuccess }) {
  const { refresh } = useUserAuth()
  const { t } = useSiteLocale()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
        if (data.code === 'email_claim_required') {
          setError(t('auth.accountClaimRequired'))
        } else {
          setError(parseApiError(data, t('form.networkError'), res.status))
        }
        return
      }
      await refresh()
      onSuccess()
    } catch {
      setError(t('form.networkError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      <p className="rounded-lg border border-teal-500/20 bg-teal-950/20 px-3 py-2 text-sm text-teal-100/90">
        {t('auth.registerNewsletterNote')}
      </p>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.fullName')}</span>
        <input
          type="text"
          required
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('common.email')}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.password')}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm text-stone-300">{t('auth.confirmPassword')}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-lime-500 px-4 py-3 font-semibold text-stone-950 transition hover:bg-lime-400 disabled:opacity-60"
      >
        {loading ? t('auth.creatingAccount') : t('auth.register')}
      </button>
      <p className="text-center text-sm text-stone-500">
        {t('auth.hasAccount')}{' '}
        <button type="button" onClick={onSwitchLogin} className="text-lime-300 underline underline-offset-2">
          {t('auth.signIn')}
        </button>
        {' · '}
        <button type="button" onClick={onForgotPassword} className="text-lime-300 underline underline-offset-2">
          {t('auth.forgotPassword')}
        </button>
      </p>
    </form>
  )
}

export function AuthModal() {
  const { authModal, closeAuthModal, openAuthModal } = useUserAuth()
  const { t } = useSiteLocale()
  const navigate = useNavigate()
  const location = useLocation()
  const [resetMeta, setResetMeta] = useState(null)
  const [loginBanner, setLoginBanner] = useState('')

  const open = Boolean(authModal)
  const view =
    authModal === 'register'
      ? 'register'
      : authModal === 'forgot'
        ? 'forgot'
        : authModal === 'reset'
          ? 'reset'
          : 'login'

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') closeAuthModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closeAuthModal])

  if (!open || authModal === 'profile') return null

  const title =
    view === 'register'
      ? t('auth.registerTitle')
      : view === 'forgot'
        ? t('auth.forgotPasswordTitle')
        : view === 'reset'
          ? t('auth.resetPasswordTitle')
          : t('auth.loginTitle')

  function afterAuthSuccess() {
    closeAuthModal()
    const from = typeof location.state?.from === 'string' ? location.state.from : '/account'
    navigate(from.startsWith('/') ? from : '/account', { replace: true })
  }

  function goToLogin(opts = {}) {
    setResetMeta(null)
    setLoginBanner(typeof opts.successMessage === 'string' ? opts.successMessage : '')
    openAuthModal('login')
  }

  function onCodeSent(meta) {
    setResetMeta(meta || null)
    openAuthModal('reset')
  }

  return (
    <ModalPortal>
      <div
        className="ss-entry-modal-overlay fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4 lg:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div
          className="absolute inset-0 bg-black/80"
          role="presentation"
          onClick={closeAuthModal}
        />
        <div className="ss-entry-modal-panel relative z-10 mx-auto flex max-h-[min(96dvh,980px)] w-[min(100%,22rem)] flex-col rounded-t-2xl border border-white/10 bg-stone-950 shadow-2xl sm:max-h-[min(92vh,900px)] sm:w-[24rem] sm:rounded-2xl">
          <div
            className="h-1 w-full bg-gradient-to-r from-lime-500/80 via-emerald-500/60 to-transparent"
            aria-hidden
          />
          <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <h2 id="auth-modal-title" className="text-lg font-semibold leading-snug text-stone-100">
              {title}
            </h2>
            <button
              type="button"
              onClick={closeAuthModal}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-white/5 hover:text-stone-200"
              aria-label={t('common.close')}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
            {view === 'register' ? (
              <RegisterForm
                onSwitchLogin={() => openAuthModal('login')}
                onForgotPassword={() => openAuthModal('forgot')}
                onSuccess={afterAuthSuccess}
              />
            ) : view === 'forgot' ? (
              <ForgotPasswordForm onSwitchLogin={goToLogin} onCodeSent={onCodeSent} />
            ) : view === 'reset' ? (
              <ResetPasswordForm onSwitchLogin={goToLogin} resetMeta={resetMeta} />
            ) : (
              <>
                {loginBanner ? (
                  <p className="mb-4 rounded-lg border border-lime-500/30 bg-lime-950/30 px-3 py-2 text-sm text-lime-200" role="status">
                    {loginBanner}
                  </p>
                ) : null}
                <LoginForm
                  onSwitchRegister={() => openAuthModal('register')}
                  onForgotPassword={() => openAuthModal('forgot')}
                  onSuccess={afterAuthSuccess}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
