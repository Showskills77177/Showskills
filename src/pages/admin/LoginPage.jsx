import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLogo } from '../../admin/AdminLogo'
import { AdminThemePicker } from '../../admin/AdminThemePicker'
import { useAdminTheme } from '../../admin/AdminThemeContext'
import { adminThemeRootClass } from '../../admin/adminThemes.mjs'
import { apiUrl } from '../../lib/api'

function parseLoginResponse(res, text) {
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    /* non-JSON */
  }
  return { data, apiMsg: typeof data.error === 'string' ? data.error : '' }
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme } = useAdminTheme()
  const from = typeof location.state?.from === 'string' ? location.state.from : '/admin/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpStep, setOtpStep] = useState(false)
  const [maskedDestination, setMaskedDestination] = useState('')
  const [sandboxNote, setSandboxNote] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [setupStatus, setSetupStatus] = useState(null)
  const [resetStep, setResetStep] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetUsername, setResetUsername] = useState('')
  const [resetSecretAnswer, setResetSecretAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const otpInputRef = useRef(null)

  useEffect(() => {
    if (otpStep) {
      const t = setTimeout(() => otpInputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
    return undefined
  }, [otpStep])

  useEffect(() => {
    let cancelled = false
    fetch(apiUrl('/api/admin/setup-status'), { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSetupStatus(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return undefined
    const t = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  function applyOtpStepFromResponse(data) {
    setOtpStep(true)
    setMaskedDestination(
      typeof data.maskedDestination === 'string'
        ? data.maskedDestination
        : typeof data.maskedPhone === 'string'
          ? data.maskedPhone
          : '',
    )
    setSandboxNote(typeof data.sandboxNote === 'string' ? data.sandboxNote : '')
    setOtpCode('')
  }

  const onResendCode = useCallback(async () => {
    if (resendCooldown > 0 || resendLoading) return
    setError('')
    setInfo('')
    setResendLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25_000)
      const res = await fetch(apiUrl('/api/admin/resend-code'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const text = await res.text()
      const { data, apiMsg } = parseLoginResponse(res, text)
      if (!res.ok) {
        setError(apiMsg || `Could not resend code (HTTP ${res.status}).`)
        if (res.status === 401) setOtpStep(false)
        return
      }
      applyOtpStepFromResponse(data)
      setInfo(typeof data.message === 'string' ? data.message : 'A new code has been sent.')
      setResendCooldown(60)
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      setError(
        aborted
          ? 'Resend timed out. Try again or sign in with password again.'
          : `Network error (${err instanceof Error ? err.message : String(err)}).`,
      )
    } finally {
      setResendLoading(false)
    }
  }, [resendCooldown, resendLoading])

  const onResendResetCode = useCallback(async () => {
    if (resendCooldown > 0 || resendLoading) return
    setError('')
    setInfo('')
    setResendLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/resend-reset-code'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const text = await res.text()
      const { data, apiMsg } = parseLoginResponse(res, text)
      if (!res.ok) {
        setError(apiMsg || `Could not resend code (HTTP ${res.status}).`)
        if (res.status === 401) setResetStep(false)
        return
      }
      applyOtpStepFromResponse(data)
      setInfo(typeof data.message === 'string' ? data.message : 'A new reset code has been sent.')
      setResendCooldown(60)
    } catch (err) {
      setError(`Network error (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setResendLoading(false)
    }
  }, [resendCooldown, resendLoading])

  async function onForgotPasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/forgot-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername.trim(), secretAnswer: resetSecretAnswer }),
      })
      const text = await res.text()
      const { data, apiMsg } = parseLoginResponse(res, text)
      if (!res.ok) {
        setError(apiMsg || `Could not send reset code (HTTP ${res.status}).`)
        return
      }
      applyOtpStepFromResponse(data)
      setResetStep(true)
      setResendCooldown(60)
      setInfo(typeof data.message === 'string' ? data.message : 'Reset code sent.')
    } catch (err) {
      setError(`Network error (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }

  async function onResetPasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/reset-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: otpCode.trim(),
          newPassword,
          confirmPassword,
        }),
      })
      const text = await res.text()
      const { data, apiMsg } = parseLoginResponse(res, text)
      if (!res.ok) {
        setError(apiMsg || `Reset failed (HTTP ${res.status}).`)
        if (res.status === 401 && apiMsg.includes('expired')) setResetStep(false)
        return
      }
      setResetStep(false)
      setOtpStep(false)
      setOtpCode('')
      setNewPassword('')
      setConfirmPassword('')
      setPassword('')
      setUsername(resetUsername.trim() || username.trim())
      setInfo(typeof data.message === 'string' ? data.message : 'Password updated. Sign in below.')
    } catch (err) {
      setError(`Network error (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }

  async function onPasswordSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 25_000)
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const text = await res.text()
      const { data, apiMsg } = parseLoginResponse(res, text)
      if (!res.ok) {
        const resendSandbox =
          apiMsg.includes('testing emails to your own email') ||
          apiMsg.includes('verify a domain')
        const hint = resendSandbox
          ? ' Local: ensure `npm run dev:api` is running on port 3000 (not an old server). Codes must go to RESEND_ACCOUNT_EMAIL in .env until showskills.co.uk is verified on Resend.'
          : res.status === 502 || res.status === 504 || res.status === 404
            ? import.meta.env.PROD
              ? ' Check Vercel env vars and redeploy.'
              : ' Run npm run dev:all. If the terminal shows EADDRINUSE on port 3000, kill that port and restart.'
            : ''
        const missing = Array.isArray(data.missing) ? data.missing.join(', ') : ''
        setError(
          (apiMsg || (text.trim() ? `${res.status}: ${text.trim().slice(0, 160)}` : '')) +
            (missing ? ` Missing: ${missing}.` : '') +
            (data.hint ? ` ${data.hint}` : '') +
            (!apiMsg && !text.trim() ? `Could not reach login API (HTTP ${res.status}).${hint}` : hint),
        )
        return
      }
      if (data.verificationRequired || data.smsRequired) {
        applyOtpStepFromResponse(data)
        setResendCooldown(60)
        return
      }
      navigate(from.startsWith('/admin') ? from : '/admin/dashboard', { replace: true })
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError'
      setError(
        aborted
          ? 'Request timed out. Check Vercel deployment and RESEND_API_KEY on Production.'
          : `Network error (${err instanceof Error ? err.message : String(err)}). Check API is running and use the same host as the site.`,
      )
    } finally {
      setLoading(false)
    }
  }

  async function onOtpSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const res = await fetch(apiUrl('/api/admin/verify-sms'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: otpCode.trim() }),
      })
      const text = await res.text()
      const { data, apiMsg } = parseLoginResponse(res, text)
      if (!res.ok) {
        const notFound =
          res.status === 404 &&
          (apiMsg === 'Not found' || String(data?.path || '').includes('verify-sms'))
        setError(
          notFound
            ? 'Verify endpoint not found on the local API. Restart npm run dev:all (server.js must include /api/admin/verify-sms).'
            : apiMsg || `Verification failed (HTTP ${res.status}).`,
        )
        if (res.status === 401 && apiMsg.includes('expired')) {
          setOtpStep(false)
        }
        return
      }
      navigate(from.startsWith('/admin') ? from : '/admin/dashboard', { replace: true })
    } catch (err) {
      setError(`Network error (${err instanceof Error ? err.message : String(err)}).`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`${adminThemeRootClass(theme)} ${theme.loginOuter}`}>
      <div className="absolute right-4 top-4">
        <AdminThemePicker compact />
      </div>
      <div className={theme.loginCard}>
        <div className="mb-6 flex justify-center">
          <AdminLogo linkTo={null} size="lg" />
        </div>
        <h1 className={theme.loginTitle}>
          {resetStep ? 'Reset admin password' : forgotOpen ? 'Forgot password' : otpStep ? 'Verify sign-in' : 'Admin sign in'}
        </h1>
        {resetStep ? (
          <>
            <p className="mt-2 text-center text-sm text-stone-400">
              Enter the 6-digit code sent to{' '}
              <span className="font-mono text-stone-300">{maskedDestination || 'your admin email'}</span>, then choose
              a new password.
            </p>
            {sandboxNote ? (
              <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-200/90">
                {sandboxNote}
              </p>
            ) : null}
            <form className="mt-6 flex flex-col gap-4" onSubmit={onResetPasswordSubmit}>
              <div>
                <label htmlFor="admin-reset-otp" className="block text-xs font-medium text-stone-400">
                  Reset code
                </label>
                <input
                  ref={otpInputRef}
                  id="admin-reset-otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={theme.inputOtp}
                  placeholder="000000"
                />
              </div>
              <div>
                <label htmlFor="admin-new-pass" className="block text-xs font-medium text-stone-400">
                  New password
                </label>
                <input
                  id="admin-new-pass"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={theme.input}
                />
              </div>
              <div>
                <label htmlFor="admin-confirm-pass" className="block text-xs font-medium text-stone-400">
                  Confirm new password
                </label>
                <input
                  id="admin-confirm-pass"
                  type={showNewPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={theme.input}
                />
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-stone-400 select-none">
                  <input
                    type="checkbox"
                    checked={showNewPassword}
                    onChange={(e) => setShowNewPassword(e.target.checked)}
                    className={theme.checkbox}
                  />
                  Show passwords
                </label>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {info ? <p className="text-sm text-teal-400/90">{info}</p> : null}
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6 || newPassword.length < 8 || !confirmPassword}
                className="min-h-[44px] rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                disabled={resendLoading || resendCooldown > 0}
                onClick={onResendResetCode}
                className={theme.secondaryBtn}
              >
                {resendLoading
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : 'Resend code'}
              </button>
              <button
                type="button"
                className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-300"
                onClick={() => {
                  setResetStep(false)
                  setForgotOpen(false)
                  setOtpStep(false)
                  setOtpCode('')
                  setNewPassword('')
                  setConfirmPassword('')
                  setError('')
                  setInfo('')
                  setResendCooldown(0)
                }}
              >
                Back to sign in
              </button>
            </form>
          </>
        ) : forgotOpen ? (
          <>
            <p className="mt-2 text-center text-sm text-stone-400">
              Enter your admin username and answer the security question. A reset code will be emailed to{' '}
              {setupStatus?.maskedAdminEmail || 'the address on file'}.
            </p>
            <form className="mt-6 flex flex-col gap-4" onSubmit={onForgotPasswordSubmit}>
              <div>
                <label htmlFor="admin-reset-user" className="block text-xs font-medium text-stone-400">
                  Admin username
                </label>
                <input
                  id="admin-reset-user"
                  autoComplete="username"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  className={theme.input}
                />
              </div>
              {setupStatus?.resetSecretQuestion ? (
                <div>
                  <label htmlFor="admin-reset-secret" className="block text-xs font-medium text-stone-400">
                    {setupStatus.resetSecretQuestion}
                  </label>
                  <input
                    id="admin-reset-secret"
                    type="text"
                    autoComplete="off"
                    value={resetSecretAnswer}
                    onChange={(e) => setResetSecretAnswer(e.target.value)}
                    className={theme.input}
                  />
                </div>
              ) : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {info ? <p className="text-sm text-teal-400/90">{info}</p> : null}
              <button
                type="submit"
                disabled={loading || !resetUsername.trim() || !resetSecretAnswer.trim()}
                className="rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
              <button
                type="button"
                className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-300"
                onClick={() => {
                  setForgotOpen(false)
                  setResetSecretAnswer('')
                  setError('')
                  setInfo('')
                }}
              >
                Back to sign in
              </button>
            </form>
          </>
        ) : otpStep ? (
          <>
            <p className="mt-2 text-center text-sm text-stone-400">
              Enter the 6-digit code sent to{' '}
              <span className="font-mono text-stone-300">{maskedDestination || 'your email'}</span>.
            </p>
            {sandboxNote ? (
              <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-center text-xs text-amber-200/90">
                {sandboxNote}
              </p>
            ) : null}
            <form className="mt-6 flex flex-col gap-4" onSubmit={onOtpSubmit}>
              <div>
                <label htmlFor="admin-otp-code" className="block text-xs font-medium text-stone-400">
                  Email verification code
                </label>
                <input
                  ref={otpInputRef}
                  id="admin-otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={theme.inputOtp}
                  placeholder="000000"
                />
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {info ? <p className="text-sm text-teal-400/90">{info}</p> : null}
              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="min-h-[44px] rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify and continue'}
              </button>
              <p className="text-center text-xs text-stone-500">Didn&apos;t get the email?</p>
              <button
                type="button"
                disabled={resendLoading || resendCooldown > 0}
                onClick={onResendCode}
                aria-label="Resend verification code to email"
                className={theme.secondaryBtn}
              >
                {resendLoading
                  ? 'Sending…'
                  : resendCooldown > 0
                    ? `Resend code (${resendCooldown}s)`
                    : 'Resend code'}
              </button>
              <button
                type="button"
                className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-300"
                onClick={() => {
                  setOtpStep(false)
                  setOtpCode('')
                  setError('')
                  setInfo('')
                  setResendCooldown(0)
                }}
              >
                Back to password
              </button>
            </form>
          </>
        ) : (
          <>
            {import.meta.env.DEV ? (
              <>
                <p className="mt-2 text-center text-xs text-stone-500">Local admin — not linked from the public site.</p>
                <p className="mt-2 text-center text-[11px] leading-snug text-stone-600">
                  Requires API on port 3000 (<code className="text-stone-500">npm run dev:all</code>). Local sign-in is{' '}
                  <strong className="text-stone-500">username + password only</strong> (no email code). Production still
                  uses email verification.
                </p>
              </>
            ) : (
              <p className="mt-2 text-center text-xs text-stone-500">Staff access only. Email verification may be required.</p>
            )}
            {setupStatus && !setupStatus.emailOtpEnabled ? (
              <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/50 px-3 py-2 text-center text-xs text-amber-100/90">
                Server: email codes are <strong>off</strong>.
                {setupStatus.emailOtpMissing?.length
                  ? ` Add ${setupStatus.emailOtpMissing.join(' + ')} on Vercel (Production) and redeploy.`
                  : ' Check Vercel env vars and redeploy.'}
              </p>
            ) : null}
            {setupStatus?.emailOtpEnabled && setupStatus.maskedAdminEmail ? (
              <p className="mt-2 text-center text-[11px] text-stone-500">
                Codes will be sent to {setupStatus.maskedAdminEmail}
              </p>
            ) : null}
            <form className="mt-6 flex flex-col gap-4" onSubmit={onPasswordSubmit}>
              <div>
                <label htmlFor="admin-user" className="block text-xs font-medium text-stone-400">
                  Username or admin email
                </label>
                <input
                  id="admin-user"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={theme.input}
                />
                <p className="mt-1 text-[11px] text-stone-600">
                  Use the configured admin username, or the same email codes are sent to
                  {setupStatus?.maskedAdminEmail ? ` (${setupStatus.maskedAdminEmail})` : ''}.
                </p>
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
                  className={theme.input}
                />
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-stone-400 select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className={theme.checkbox}
                  />
                  Show password
                </label>
              </div>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
              {info ? <p className="text-sm text-teal-400/90">{info}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              {setupStatus?.passwordResetEnabled ? (
                <button
                  type="button"
                  className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-300"
                  onClick={() => {
                    setError('')
                    setInfo('')
                    setResetUsername(username.trim())
                    setForgotOpen(true)
                  }}
                >
                  Forgot password?
                </button>
              ) : null}
            </form>
          </>
        )}
      </div>
    </div>
  )
}
