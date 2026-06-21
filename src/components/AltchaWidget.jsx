import { useEffect, useRef } from 'react'
import 'altcha'
import { apiUrl } from '../lib/api'

/**
 * Self-hosted ALTCHA proof-of-work widget — no Cloudflare/Google account required.
 */
export function AltchaWidget({ challengePath = '/api/captcha/challenge', onPayload, onExpire, onError, className = '' }) {
  const widgetRef = useRef(null)
  const challengeUrl = apiUrl(challengePath)

  useEffect(() => {
    const el = widgetRef.current
    if (!el) return undefined

    el.setAttribute('challenge', challengeUrl)
    el.setAttribute('auto', 'onload')
    el.setAttribute('hidefooter', '')
    el.setAttribute('hidelogo', '')

    const handleVerified = (event) => {
      const payload = event?.detail?.payload
      if (typeof payload === 'string' && payload) {
        onPayload?.(payload)
      }
    }

    const handleStateChange = (event) => {
      const state = event?.detail?.state
      if (state === 'expired') onExpire?.()
      if (state === 'error') onError?.('Security check failed. Please try again.')
    }

    el.addEventListener('verified', handleVerified)
    el.addEventListener('statechange', handleStateChange)

    return () => {
      el.removeEventListener('verified', handleVerified)
      el.removeEventListener('statechange', handleStateChange)
    }
  }, [challengeUrl, onPayload, onExpire, onError])

  return (
    <altcha-widget
      ref={widgetRef}
      className={`ss-altcha ${className}`.trim()}
      aria-label="Security check"
    />
  )
}
