import { useEffect, useRef, useState } from 'react'

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
  const [adBlockDetected, setAdBlockDetected] = useState(false)
  const popupRef = useRef(null)
  const pollRef = useRef(null)
  const popupOpenedAtRef = useRef(0)
  const popupNavigatedRef = useRef(false)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
    }
  }, [])

  function markWatched() {
    setUnlocked(true)
    setWatching(false)
    onUnlocked?.()
  }

  function openAndWatch() {
    if (disabled || watching || unlocked) return
    if (pollRef.current) window.clearInterval(pollRef.current)
    popupOpenedAtRef.current = Date.now()
    popupNavigatedRef.current = false
    setAdBlockDetected(false)
    setPopupBlocked(false)
    const wW = 420
    const wH = 700
    const screenX = typeof window.screenX === 'number' ? window.screenX : (typeof window.screenLeft === 'number' ? window.screenLeft : 0)
    const screenY = typeof window.screenY === 'number' ? window.screenY : (typeof window.screenTop === 'number' ? window.screenTop : 0)
    const outerW = typeof window.outerWidth === 'number' ? window.outerWidth : (document.documentElement?.clientWidth || window.screen.availWidth)
    const outerH = typeof window.outerHeight === 'number' ? window.outerHeight : (document.documentElement?.clientHeight || window.screen.availHeight)
    const left = Math.max(0, Math.floor(screenX + (outerW - wW) / 2))
    const top = Math.max(0, Math.floor(screenY + (outerH - wH) / 2))
    const features = `width=${wW},height=${wH},left=${left},top=${top},menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes,status=no`
    let w = null
    try {
      // Open a same-origin blank popup first so Safari returns a window handle reliably.
      w = window.open('', 'monetag_ad_popup', features)
    } catch (e) {
      w = null
    }
    if (w) {
      popupRef.current = w
      try {
        if ('opener' in w) w.opener = null
      } catch {}
      try {
        w.location.replace(monetagUrl)
      } catch {
        w.location.href = monetagUrl
      }
      try { w.focus() } catch {}
      setWatching(true)
      // poll until the window is closed
      pollRef.current = window.setInterval(() => {
        if (!popupNavigatedRef.current) {
          try {
            const href = popupRef.current?.location?.href
            if (href && href !== 'about:blank') {
              popupNavigatedRef.current = true
            }
          } catch {
            // Cross-origin access means navigation succeeded.
            popupNavigatedRef.current = true
          }

          // Still stuck on about:blank after a grace period -> likely blocked by ad/content blocker.
          if (!popupNavigatedRef.current && Date.now() - popupOpenedAtRef.current > 3000) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            try {
              if (popupRef.current && !popupRef.current.closed) popupRef.current.close()
            } catch {}
            popupRef.current = null
            setWatching(false)
            setAdBlockDetected(true)
            return
          }
        }

        try {
          if (!popupRef.current || popupRef.current.closed) {
            if (pollRef.current) window.clearInterval(pollRef.current)
            if (popupNavigatedRef.current) {
              markWatched()
            } else {
              setWatching(false)
              setAdBlockDetected(true)
            }
          }
        } catch (e) {
          // cross-origin access may throw; still check closed
          try {
            if (popupRef.current && popupRef.current.closed) {
              if (pollRef.current) window.clearInterval(pollRef.current)
              if (popupNavigatedRef.current) {
                markWatched()
              } else {
                setWatching(false)
                setAdBlockDetected(true)
              }
            }
          } catch (_) {}
        }
      }, 1000)
    } else {
      // Popup was blocked by the browser. Don't navigate away — show instructions only.
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
              Popup blocked — please allow popups for this site, then click "Watch ad to unlock" again.
            </p>
          ) : null}
          {adBlockDetected ? (
            <p className="text-xs text-red-400" role="alert">
              Ad/content blocker detected — disable your blocker for this page, then click "Watch ad to unlock" again.
            </p>
          ) : null}
          <button
            type="button"
            onClick={openAndWatch}
            disabled={disabled || watching}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-950/35 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {watching ? 'Watching ad…' : 'Watch ad to unlock'}
          </button>
        </div>
      )}
    </div>
  )
}
