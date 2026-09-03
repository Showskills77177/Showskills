import { useEffect, useRef, useState } from 'react'

/**
 * HilltopAds VAST video ad gate used to require watching an ad before unlocking the practice
 * question. This fetches a real VAST (Video Ad Serving Template) tag, parses the InLine ad's
 * MediaFile, and plays the actual ad creative inline via a native <video> element rendered on
 * top of the quiz page (no popup window, no navigation away). Unlocking is tied strictly to the
 * browser's native `ended` event on that <video> element — the user must play the ad video to
 * completion. There is no manual bypass and no skip control.
 *
 * Props:
 * - vastTagUrl: string (required) — HilltopAds VAST tag URL
 * - onUnlocked: () => void
 * - disabled: boolean
 */

function fireTrackingPixel(url) {
  if (!url) return
  try {
    const img = new Image()
    img.referrerPolicy = 'no-referrer-when-downgrade'
    img.src = url
  } catch {
    // Ignore tracking pixel failures — they must never block the gate.
  }
}

function pickMediaFile(mediaFiles) {
  // Prefer mp4 for the broadest <video> element support; fall back to whatever is offered.
  return mediaFiles.find((m) => m.type === 'video/mp4') || mediaFiles[0] || null
}

async function fetchVastAd(vastTagUrl) {
  const res = await fetch(vastTagUrl, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error('vast_fetch_failed')
  const text = await res.text()
  const doc = new window.DOMParser().parseFromString(text, 'text/xml')
  if (doc.querySelector('parsererror')) throw new Error('vast_parse_failed')

  const inline = doc.querySelector('Ad > InLine')
  if (!inline) throw new Error('vast_no_ad')

  const impressions = Array.from(inline.querySelectorAll('Impression'))
    .map((n) => n.textContent.trim())
    .filter(Boolean)
  const errorPixels = Array.from(doc.querySelectorAll('Error'))
    .map((n) => n.textContent.trim())
    .filter(Boolean)
  const trackingEvents = Array.from(inline.querySelectorAll('TrackingEvents > Tracking')).map((n) => ({
    event: n.getAttribute('event'),
    url: n.textContent.trim(),
  }))
  const mediaFiles = Array.from(inline.querySelectorAll('MediaFiles > MediaFile')).map((n) => ({
    type: n.getAttribute('type'),
    url: n.textContent.trim(),
  }))
  const mediaFile = pickMediaFile(mediaFiles)
  if (!mediaFile) throw new Error('vast_no_media')

  return { impressions, errorPixels, trackingEvents, mediaFile }
}

export default function VastVideoAdGate({ vastTagUrl, onUnlocked, disabled = false }) {
  const [phase, setPhase] = useState('idle') // idle | loading | playing | unlocked | error
  const [errorMessage, setErrorMessage] = useState('')
  const [ad, setAd] = useState(null)
  const [muted, setMuted] = useState(true)
  const videoRef = useRef(null)
  const mountedRef = useRef(true)
  const impressionsFiredRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      // Intentionally read the live ref here (not a mount-time snapshot): the <video> element
      // is only mounted conditionally while an ad is playing, so we must stop whatever element
      // is actually attached at unmount time.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const video = videoRef.current
      if (video) {
        try {
          video.pause()
          video.removeAttribute('src')
          video.load()
        } catch {
          // Ignore cleanup failures on unmount.
        }
      }
    }
  }, [])

  function fireTracking(eventName) {
    ad?.trackingEvents?.filter((t) => t.event === eventName).forEach((t) => fireTrackingPixel(t.url))
  }

  function fireErrorPixel(code) {
    ad?.errorPixels?.forEach((url) => fireTrackingPixel(url.replace('[ERRORCODE]', String(code))))
  }

  async function watchAd() {
    if (disabled || phase === 'loading' || phase === 'playing' || phase === 'unlocked') return
    setErrorMessage('')
    setPhase('loading')
    impressionsFiredRef.current = false
    try {
      const loadedAd = await fetchVastAd(vastTagUrl)
      if (!mountedRef.current) return
      setAd(loadedAd)
      setMuted(true)
      setPhase('playing')
    } catch {
      if (!mountedRef.current) return
      setPhase('error')
      setErrorMessage('The ad could not be loaded. Click "Watch ad to unlock" to try again.')
    }
  }

  function handleCanPlay() {
    if (!impressionsFiredRef.current) {
      impressionsFiredRef.current = true
      ad?.impressions?.forEach(fireTrackingPixel)
      fireTracking('start')
    }
    // Attempt unmuted playback since this was triggered by a direct user click; fall back to
    // muted autoplay (always permitted by browsers) if that is blocked.
    const video = videoRef.current
    if (!video) return
    video.muted = false
    const playPromise = video.play()
    if (playPromise?.catch) {
      playPromise.catch(() => {
        if (!mountedRef.current || !videoRef.current) return
        videoRef.current.muted = true
        setMuted(true)
        videoRef.current.play().catch(() => {})
      })
    } else {
      setMuted(false)
    }
  }

  function handleEnded() {
    fireTracking('complete')
    if (!mountedRef.current) return
    setPhase('unlocked')
    onUnlocked?.()
  }

  function handleVideoError() {
    fireErrorPixel(405)
    if (!mountedRef.current) return
    setPhase('error')
    setErrorMessage('The ad video failed to play. Click "Watch ad to unlock" to try again.')
  }

  function toggleMute() {
    if (!videoRef.current) return
    const next = !videoRef.current.muted
    videoRef.current.muted = next
    setMuted(next)
  }

  return (
    <div>
      {phase === 'unlocked' ? (
        <button
          type="button"
          onClick={() => onUnlocked?.()}
          className="w-full rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 py-3 text-sm font-bold text-stone-950 shadow-lg transition hover:brightness-110"
        >
          Start practice (unlocked)
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-stone-400">Watch a short ad video to unlock the practice question.</p>
          {errorMessage ? (
            <p className="text-xs text-red-400" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {phase === 'playing' && ad?.mediaFile ? (
            <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-black">
              <video
                ref={videoRef}
                key={ad.mediaFile.url}
                src={ad.mediaFile.url}
                autoPlay
                muted={muted}
                playsInline
                controls={false}
                className="w-full"
                onCanPlay={handleCanPlay}
                onEnded={handleEnded}
                onError={handleVideoError}
              />
              <button
                type="button"
                onClick={toggleMute}
                className="absolute bottom-2 right-2 rounded-lg bg-black/60 px-2 py-1 text-xs font-semibold text-white"
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void watchAd()}
            disabled={disabled || phase === 'loading' || phase === 'playing'}
            className="w-full rounded-xl border border-amber-500/40 bg-amber-950/35 py-3 text-sm font-bold text-amber-100 shadow-lg transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === 'loading' ? 'Loading ad…' : phase === 'playing' ? 'Watching ad…' : 'Watch ad to unlock'}
          </button>
        </div>
      )}
    </div>
  )
}
