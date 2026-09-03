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
    let w
    try {
      w = window.open(monetagUrl, '_blank', 'noopener')
    } catch (e) {
      w = null
    }
    if (w) {
      popupRef.current = w
      setWatching(true)
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
      // popup blocked — show fallback: open in same tab
      // open new tab via location.assign as fallback
      // open in same tab and instruct user to return
      window.location.href = monetagUrl
      // After navigation they will be on the ad page; when they come back the session flag may not be set.
      // Provide a manual "I watched the ad" fallback below by rendering a confirm button.
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
