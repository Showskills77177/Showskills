import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AdminLogo } from '../../admin/AdminLogo'
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-stone-900/80 p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <AdminLogo linkTo={null} size="lg" />
        </div>
        <h1 className="text-center text-lg font-semibold text-stone-100">Admin sign in</h1>
        {otpStep ? (
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
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-stone-100 focus:border-teal-600/50 focus:outline-none focus:ring-2 focus:ring-teal-900/40"
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
                className="min-h-[44px] rounded-xl border border-white/15 py-2.5 text-sm font-medium text-stone-200 hover:border-teal-600/40 hover:text-teal-100 disabled:opacity-50"
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
                  Requires API on port 3000 (<code className="text-stone-500">npm run dev:all</code>). If sign-in
                  fails with a Resend error, check the terminal for{' '}
                  <code className="text-stone-500">EADDRINUSE</code> — kill port 3000 and restart. Local codes go to{' '}
                  <code className="text-stone-500">RESEND_ACCOUNT_EMAIL</code> until the domain is verified.
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
          </>
        )}
      </div>
    </div>
  )
}
