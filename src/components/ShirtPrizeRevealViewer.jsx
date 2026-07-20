import { useCallback, useEffect, useRef, useState } from 'react'
import { SHIRT_PRIZE_REVEAL_VIEW_SECONDS } from '../../shared/shirtPrizeReveal.mjs'
import { apiFetch } from '../lib/api'
import { ShirtGiveawayJerseyImagery } from './ShirtGiveawayJerseyImagery'

function formatCountdown(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  return s === 1 ? '1 second' : `${s} seconds`
}

/**
 * One-time timed shirt prize preview for giveaway entrants.
 */
export function ShirtPrizeRevealViewer({ previewToken, entryNumber: entryNumberProp = '' }) {
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(SHIRT_PRIZE_REVEAL_VIEW_SECONDS)
  const [entryNumber, setEntryNumber] = useState(entryNumberProp)
  const endTimerRef = useRef(null)
  const tickRef = useRef(null)
  const viewEndsAtRef = useRef(0)

  const endView = useCallback(() => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    if (tickRef.current) clearInterval(tickRef.current)
    endTimerRef.current = null
    tickRef.current = null
    setPhase('ended')
  }, [])

  const startView = useCallback(async () => {
    setError('')
    setPhase('loading')
    try {
      const res = await apiFetch('/api/shirt-prize-reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: previewToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error || 'Preview is not available for this link.')
        setPhase('error')
        return
      }
      const viewSeconds = Number(data.viewSeconds) || SHIRT_PRIZE_REVEAL_VIEW_SECONDS
      if (data.entryNumber) setEntryNumber(String(data.entryNumber))
      viewEndsAtRef.current = Date.now() + viewSeconds * 1000
      setSecondsLeft(viewSeconds)
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
  }, [previewToken, endView])

  useEffect(
    () => () => {
      if (endTimerRef.current) clearTimeout(endTimerRef.current)
      if (tickRef.current) clearInterval(tickRef.current)
    },
    [],
  )

  useEffect(() => {
    if (phase !== 'viewing') return undefined
    const onVisibility = () => {
      if (document.hidden) endView()
    }
    const onContextMenu = (e) => e.preventDefault()
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [phase, endView])

  const watermark = entryNumber ? `Entry ${entryNumber}` : 'Shirt giveaway'

  return (
    <div className="ss-shirt-prize-reveal">
      {phase === 'idle' ? (
        <div className="ss-prize-reveal-panel mx-auto max-w-lg text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300/90">Shirt giveaway preview</p>
          <h1 className="mt-3 font-display text-2xl uppercase tracking-wide text-white sm:text-3xl">
            Signed Ronaldo United shirt
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-stone-300">
            View the prize shirt imagery for{' '}
            <strong className="text-lime-100">{SHIRT_PRIZE_REVEAL_VIEW_SECONDS} seconds</strong> —{' '}
            <strong className="text-lime-100">one time only</strong>. Sponsor, league, and signature marks stay blurred.
          </p>
          <button
            type="button"
            onClick={startView}
            className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-xl bg-gradient-to-r from-lime-600 to-emerald-600 px-8 text-base font-bold text-stone-950 shadow-lg transition hover:from-lime-500 hover:to-emerald-500"
          >
            View shirt imagery
          </button>
        </div>
      ) : null}

      {phase === 'loading' ? <p className="text-center text-sm text-stone-400">Preparing your preview…</p> : null}

      {phase === 'error' ? (
        <div className="ss-prize-reveal-panel mx-auto max-w-md text-center">
          <p className="text-amber-200/90">{error}</p>
        </div>
      ) : null}

      {phase === 'viewing' ? (
        <div className="ss-shirt-prize-reveal-stage relative" role="dialog" aria-modal="true" aria-label="Timed shirt preview">
          <div className="ss-prize-reveal-timer" aria-live="polite">
            Closing in {formatCountdown(secondsLeft)}
          </div>
          <div className="ss-shirt-prize-reveal-wrap relative mx-auto max-w-lg select-none">
            <ShirtGiveawayJerseyImagery size="lg" showNotice />
            <div className="ss-prize-reveal-watermark" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
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
            Your {SHIRT_PRIZE_REVEAL_VIEW_SECONDS}-second viewing window has ended. This was your one-time shirt preview.
          </p>
        </div>
      ) : null}
    </div>
  )
}
