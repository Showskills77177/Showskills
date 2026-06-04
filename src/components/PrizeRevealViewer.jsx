import { useCallback, useEffect, useRef, useState } from 'react'
import { PRIZE_REVEAL_VIEW_SECONDS } from '../../shared/prizeReveal.mjs'
import { LegacyBundlePrizeStudio } from './LegacyBundlePrizeStudio'

function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  return s === 1 ? '1 second' : `${s} seconds`
}

/**
 * Timed bundle preview for paid purchasers — same prize studio imagery as the public site.
 */
export function PrizeRevealViewer({ resumeToken, orderRef: orderRefProp = '' }) {
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [errorKind, setErrorKind] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(PRIZE_REVEAL_VIEW_SECONDS)
  const [authorized, setAuthorized] = useState(false)
  const [orderRef, setOrderRef] = useState(orderRefProp)
  const [guardFlash, setGuardFlash] = useState(false)
  const endTimerRef = useRef(null)
  const tickRef = useRef(null)
  const viewEndsAtRef = useRef(0)

  const endView = useCallback(() => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    endTimerRef.current = null
    tickRef.current = null
    setAuthorized(false)
    setPhase('ended')
  }, [])

  const startView = useCallback(async () => {
    setError('')
    setErrorKind('')
    setGuardFlash(false)
    setPhase('loading')
    try {
      const res = await fetch('/api/prize-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resumeToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        const message = data.error || 'Preview is not available for this link.'
        setError(message)
        setErrorKind(
          /one-time|already used/i.test(message)
            ? 'used'
            : /correct answers|qualified/i.test(message)
              ? 'not_qualified'
              : 'generic',
        )
        setPhase('error')
        return
      }
      const viewSeconds = Number(data.viewSeconds) || PRIZE_REVEAL_VIEW_SECONDS
      if (data.orderRef) setOrderRef(String(data.orderRef))
      viewEndsAtRef.current = Date.now() + viewSeconds * 1000
      setSecondsLeft(viewSeconds)
      setAuthorized(true)
      setPhase('viewing')

      tickRef.current = setInterval(() => {
        const left = (viewEndsAtRef.current - Date.now()) / 1000
        setSecondsLeft(Math.max(0, left))
        if (left <= 0) endView()
      }, 200)

      endTimerRef.current = setTimeout(endView, viewSeconds * 1000)
    } catch {
      setError('Could not connect. Check your connection and try again.')
      setPhase('error')
    }
  }, [resumeToken, endView])

  useEffect(
    () => () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    },
    [],
  )

  useEffect(() => {
    if (phase !== 'viewing') return undefined

    const blockCaptureKeys = (e) => {
      const key = e.key?.toLowerCase?.() || ''
      const printish =
        key === 'printscreen' ||
        (e.metaKey && e.shiftKey && (key === '3' || key === '4' || key === '5')) ||
        (e.ctrlKey && key === 'p')
      if (printish) {
        e.preventDefault()
        setGuardFlash(true)
        window.setTimeout(() => setGuardFlash(false), 1200)
      }
    }

    const onVisibility = () => {
      if (document.hidden) endView()
    }

    const onBlur = () => {
      if (document.hidden) endView()
    }

    const onContextMenu = (e) => e.preventDefault()

    document.addEventListener('keydown', blockCaptureKeys, true)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    document.addEventListener('contextmenu', onContextMenu)

    return () => {
      document.removeEventListener('keydown', blockCaptureKeys, true)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [phase, endView])

  const watermark = orderRef ? `Order ${orderRef}` : 'Paid preview'

  return (
    <div className="ss-prize-reveal">
      {phase === 'idle' ? (
        <div className="ss-prize-reveal-panel mx-auto max-w-lg text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/90">Qualified entrant preview</p>
          <h1 className="mt-3 font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
            Your bundle prize imagery
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-300">
            You qualified with all three correct answers. Tap below to see the{' '}
            <strong className="text-amber-100">same poster, iPhone, and gold case</strong> as on the site — including the
            collectibles stamp — for <strong className="text-amber-100">{PRIZE_REVEAL_VIEW_SECONDS} seconds</strong>.
            <strong className="text-amber-100"> One view only</strong> — this link cannot be opened again.
          </p>
          <button
            type="button"
            onClick={startView}
            className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-8 text-base font-bold text-stone-950 shadow-lg shadow-amber-900/30 transition hover:from-amber-400 hover:to-amber-500"
          >
            View bundle imagery
          </button>
          <p className="mt-6 text-xs leading-relaxed text-stone-500">
            One-time {PRIZE_REVEAL_VIEW_SECONDS}-second view. Screenshot and screen-recording tools are discouraged and may
            breach our terms.
          </p>
        </div>
      ) : null}

      {phase === 'loading' ? (
        <p className="text-center text-sm text-stone-400">Preparing your preview…</p>
      ) : null}

      {phase === 'error' ? (
        <div className="ss-prize-reveal-panel mx-auto max-w-md text-center">
          <p className="text-amber-200/90">{error}</p>
          {errorKind === 'generic' ? (
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="mt-6 text-sm font-medium text-teal-300 underline-offset-2 hover:underline"
            >
              Back
            </button>
          ) : null}
        </div>
      ) : null}

      {phase === 'viewing' && authorized ? (
        <div className="ss-prize-reveal-stage" role="dialog" aria-modal="true" aria-label="Timed prize preview">
          <div className="ss-prize-reveal-timer" aria-live="polite">
            Closing in {formatCountdown(secondsLeft)}
          </div>
          {guardFlash ? (
            <div className="ss-prize-reveal-guard-flash" role="status">
              Screenshots and recordings are not permitted for this preview.
            </div>
          ) : null}
          <div className="ss-prize-reveal-studio-wrap mx-auto max-w-2xl select-none">
            <LegacyBundlePrizeStudio hero eager className="mx-auto" />
            <div className="ss-prize-reveal-watermark" aria-hidden>
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i}>{watermark}</span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {phase === 'ended' ? (
        <div className="ss-prize-reveal-panel mx-auto max-w-md text-center">
          <p className="font-display text-xl uppercase tracking-wide text-stone-200">Preview closed</p>
          <p className="mt-3 text-sm leading-relaxed text-stone-400">
            Your {PRIZE_REVEAL_VIEW_SECONDS}-second viewing window has ended. This was your one-time prize preview — the
            link from your email cannot be used again.
          </p>
        </div>
      ) : null}
    </div>
  )
}
