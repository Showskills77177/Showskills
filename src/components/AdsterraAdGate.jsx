import { useEffect, useRef, useState } from 'react'

/**
 * Adsterra ad gate used to require watching/loading an ad before unlocking the practice question.
 *
 * Adsterra's "Social Bar" tag (unlike Monetag's popup) is a self-mounting script with no
 * public "ad completed" callback — it manages its own ad display globally on the page. Since
 * there is no completion event to hook, we enforce a minimum on-page wait (while the ad script
 * loads and can display) before unlocking. There is no manual bypass: the button cannot be
 * clicked again to skip the wait, and nothing unlocks unless the ad script loads successfully.
 *
 * Props:
 * - adScriptUrl: string (required) — Adsterra ad tag script src
 * - onUnlocked: () => void
 * - disabled: boolean
 * - minWatchSeconds: number — minimum enforced wait before unlocking (default 15)
 */
const DEFAULT_MIN_WATCH_SECONDS = 15
const AD_SCRIPT_ATTR = 'data-adsterra-ad-gate'

// Module-level cache so the ad tag is only ever injected once per page load, even though the
// gate component can mount more than once (e.g. first + optional second practice unlock).
const scriptLoadPromises = new Map()

function loadAdsterraScript(src) {
  if (scriptLoadPromises.has(src)) return scriptLoadPromises.get(src)
  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[${AD_SCRIPT_ATTR}="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.setAttribute(AD_SCRIPT_ATTR, src)
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadPromises.delete(src)
      script.remove()
      reject(new Error('adsterra_script_failed'))
    }
    document.body.appendChild(script)
  })
  scriptLoadPromises.set(src, promise)
  return promise
}

export default function AdsterraAdGate({ adScriptUrl, onUnlocked, disabled = false, minWatchSeconds = DEFAULT_MIN_WATCH_SECONDS }) {
  const [watching, setWatching] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [adBlockDetected, setAdBlockDetected] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(minWatchSeconds)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  function markWatched() {
    if (!mountedRef.current) return
    setUnlocked(true)
    setWatching(false)
    onUnlocked?.()
  }

  async function watchAd() {
    if (disabled || watching || unlocked) return
    if (timerRef.current) window.clearInterval(timerRef.current)
    setAdBlockDetected(false)
    setWatching(true)
    setSecondsLeft(minWatchSeconds)

    try {
      await loadAdsterraScript(adScriptUrl)
    } catch {
      if (!mountedRef.current) return
      setWatching(false)
      setAdBlockDetected(true)
      return
    }

    if (!mountedRef.current) return
    timerRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current)
          markWatched()
          return 0
        }
        return prev - 1
      })
    }, 1000)
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
          {adBlockDetected ? (
            <p className="text-xs text-red-400" role="alert">
              Ad/content blocker detected — disable your blocker for this page, then click "Watch ad to unlock" again.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void watchAd()}
            disabled={disabled || watching}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-950/35 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {watching ? `Watching ad… (${secondsLeft}s)` : 'Watch ad to unlock'}
          </button>
        </div>
      )}
    </div>
  )
}
