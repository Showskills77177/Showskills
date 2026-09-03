import { useEffect, useState, useRef } from 'react'

/**
 * Monetag Ad gate used to require watching an ad before unlocking the practice question.
 * Props:
 * - monetagUrl: string (required)
 * - onUnlocked: () => void
 * - disabled: boolean
 */
export default function MonetagAdGate({ monetagUrl, onUnlocked, disabled = false }) {
  const [watching, setWatching] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const popupRef = useRef(null)
  const pollRef = useRef(null)

  useEffect(() => {
    // read persisted flag (sessionStorage) so reload doesn't require rewatching
    try {
      const v = sessionStorage.getItem('wc_practice_ad_watched')
      if (v === '1') {
        setUnlocked(true)
        onUnlocked?.()
      }
    } catch {}
  }, [])

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
    }
  }, [])

  function markWatched() {
    try {
      sessionStorage.setItem('wc_practice_ad_watched', '1')
    } catch {}
    setUnlocked(true)
    setWatching(false)
    onUnlocked?.()
  }

  function openAndWatch() {
    if (disabled || watching || unlocked) return
    const wW = 420
    const wH = 700
    const screenX = typeof window.screenX === 'number' ? window.screenX : (typeof window.screenLeft === 'number' ? window.screenLeft : 0)
    const screenY = typeof window.screenY === 'number' ? window.screenY : (typeof window.screenTop === 'number' ? window.screenTop : 0)
    const outerW = typeof window.outerWidth === 'number' ? window.outerWidth : (document.documentElement?.clientWidth || window.screen.availWidth)
    const outerH = typeof window.outerHeight === 'number' ? window.outerHeight : (document.documentElement?.clientHeight || window.screen.availHeight)
    const left = Math.max(0, Math.floor(screenX + (outerW - wW) / 2))
    const top = Math.max(0, Math.floor(screenY + (outerH - wH) / 2))
    const features = `width=${wW},height=${wH},left=${left},top=${top},menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes,status=no,noopener`
    let w = null
    try {
      w = window.open(monetagUrl, 'monetag_ad_popup', features)
    } catch (e) {
      w = null
    }
    if (w) {
      popupRef.current = w
      try { w.focus() } catch {}
      try { if ('opener' in w) w.opener = null } catch {}
      setWatching(true)
      setPopupBlocked(false)
      // poll until the window is closed
      pollRef.current = window.setInterval(() => {
        try {
          if (!popupRef.current || popupRef.current.closed) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            markWatched()
          }
        } catch (e) {
          // cross-origin access may throw; still check closed
          try {
            if (popupRef.current && popupRef.current.closed) {
              if (pollRef.current) window.clearInterval(pollRef.current)
              markWatched()
            }
          } catch (_) {}
        }
      }, 1000)
    } else {
      // Popup was blocked by the browser. Don't navigate away — show instructions and manual confirm.
      setPopupBlocked(true)
      setWatching(false)
    }
  }

  return (
    <div>
      {unlocked ? (
        <button
          type="button"
          onClick={() => onUnlocked?.()}
          className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-stone-950 shadow-lg transition hover:brightness-110"
        >
          Start practice (unlocked)
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-stone-400">Watch a short ad to unlock the practice question.</p>
          {popupBlocked ? (
            <p className="text-xs text-red-400" role="alert">
              Popup blocked — please allow popups for this site, then click "Watch ad to unlock" again. If you already watched the ad in another tab/window, click "I watched".
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openAndWatch}
              disabled={disabled || watching}
              className="flex-1 rounded-xl border border-amber-500/40 bg-amber-950/35 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {watching ? 'Watching ad…' : 'Watch ad to unlock'}
            </button>
            <button
              type="button"
              onClick={() => {
                // manual confirmation fallback
                markWatched()
              }}
              disabled={disabled || watching}
              className="rounded-xl border border-stone-600/40 bg-black/40 px-3 py-3 text-sm font-semibold text-stone-200 hover:border-stone-500"
              title="Use this only if your browser blocked the ad popup."
            >
              I watched
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
