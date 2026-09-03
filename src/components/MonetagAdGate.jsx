import { useEffect, useRef, useState } from 'react'

/**
 * Monetag Rewarded Interstitial ad gate used to require watching an ad before unlocking the
 * practice question. Uses Monetag's official SDK (libtl.com/sdk.js), which exposes a
 * zone-scoped `show_<ZONE_ID>()` function returning a Promise that only resolves once the user
 * has actually watched/completed the rewarded ad (it rejects if the ad fails to load or is
 * closed early). There is no manual bypass — practice only unlocks when that promise resolves.
 *
 * Props:
 * - zoneId: string (required) — Monetag zone ID from the dashboard
 * - onUnlocked: () => void
 * - disabled: boolean
 */
const SDK_SRC = 'https://libtl.com/sdk.js'
const SDK_FN_READY_TIMEOUT_MS = 10000
const SDK_FN_POLL_INTERVAL_MS = 200

// Module-level cache so the SDK script/function is only ever set up once per zone per page
// load, even though the gate component can mount more than once (first + optional second
// practice unlock).
const sdkLoadPromises = new Map()

function waitForShowFn(fnName, resolve, reject) {
  const start = Date.now()
  const poll = window.setInterval(() => {
    if (typeof window[fnName] === 'function') {
      window.clearInterval(poll)
      resolve()
    } else if (Date.now() - start > SDK_FN_READY_TIMEOUT_MS) {
      window.clearInterval(poll)
      reject(new Error('monetag_sdk_timeout'))
    }
  }, SDK_FN_POLL_INTERVAL_MS)
}

function loadMonetagSdk(zoneId) {
  if (sdkLoadPromises.has(zoneId)) return sdkLoadPromises.get(zoneId)
  const fnName = `show_${zoneId}`
  const promise = new Promise((resolve, reject) => {
    if (typeof window[fnName] === 'function') {
      resolve()
      return
    }
    const existing = document.querySelector(`script[data-zone="${zoneId}"]`)
    if (existing) {
      waitForShowFn(fnName, resolve, (err) => {
        sdkLoadPromises.delete(zoneId)
        reject(err)
      })
      return
    }
    const script = document.createElement('script')
    script.src = SDK_SRC
    script.setAttribute('data-zone', zoneId)
    script.setAttribute('data-sdk', fnName)
    script.async = true
    script.onerror = () => {
      sdkLoadPromises.delete(zoneId)
      script.remove()
      reject(new Error('monetag_sdk_failed'))
    }
    script.onload = () => {
      waitForShowFn(fnName, resolve, (err) => {
        sdkLoadPromises.delete(zoneId)
        reject(err)
      })
    }
    document.body.appendChild(script)
  })
  sdkLoadPromises.set(zoneId, promise)
  return promise
}

export default function MonetagAdGate({ zoneId, onUnlocked, disabled = false }) {
  const [watching, setWatching] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
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
    setErrorMessage('')
    setWatching(true)
    try {
      await loadMonetagSdk(zoneId)
      const showAd = window[`show_${zoneId}`]
      if (typeof showAd !== 'function') throw new Error('monetag_unavailable')
      await showAd()
      markWatched()
    } catch (err) {
      if (!mountedRef.current) return
      setWatching(false)
      if (err?.message === 'monetag_sdk_failed' || err?.message === 'monetag_sdk_timeout') {
        setErrorMessage('Ad/content blocker detected — disable your blocker for this page, then click "Watch ad to unlock" again.')
      } else {
        setErrorMessage('The ad could not be shown or was closed early. Click "Watch ad to unlock" to try again.')
      }
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
          {errorMessage ? (
            <p className="text-xs text-red-400" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void watchAd()}
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
