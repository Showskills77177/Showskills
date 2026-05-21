import { useEffect, useRef } from 'react'
import {
  TRUSTPILOT_BUSINESS_UNIT_ID,
  TRUSTPILOT_LOCALE,
  TRUSTPILOT_REVIEW_URL,
  TRUSTPILOT_TEMPLATE_ID,
  TRUSTPILOT_TOKEN,
} from '../../shared/trustpilotConfig.mjs'

const BOOTSTRAP_ID = 'trustpilot-bootstrap'
const BOOTSTRAP_SRC = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js'

const businessUnitId =
  (import.meta.env.VITE_TRUSTPILOT_BUSINESS_UNIT_ID || TRUSTPILOT_BUSINESS_UNIT_ID).trim()
const reviewUrl = (import.meta.env.VITE_TRUSTPILOT_REVIEW_URL || TRUSTPILOT_REVIEW_URL).trim()

function loadTrustpilotScript() {
  return new Promise((resolve) => {
    if (window.Trustpilot) {
      resolve()
      return
    }
    const existing = document.getElementById(BOOTSTRAP_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      if (window.Trustpilot) resolve()
      return
    }
    const script = document.createElement('script')
    script.id = BOOTSTRAP_ID
    script.type = 'text/javascript'
    script.src = BOOTSTRAP_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })
}

/** TrustBox Review Collector — footer only. */
export function TrustpilotReviewCollector({ className = '', centered = false, compact = false }) {
  const ref = useRef(null)
  const widgetHeight = compact ? '44px' : '52px'

  useEffect(() => {
    if (!ref.current) return undefined

    let cancelled = false

    loadTrustpilotScript().then(() => {
      if (cancelled || !ref.current || !window.Trustpilot) return
      window.Trustpilot.loadFromElement(ref.current, true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const wrapClass = [
    centered ? 'mx-auto w-full' : 'w-full',
    compact ? 'max-w-[12.75rem] ss-footer-trustpilot-compact' : 'max-w-md',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapClass}>
      <div
        ref={ref}
        className={`trustpilot-widget w-full ${compact ? 'min-h-[44px]' : 'min-h-[52px]'}`}
        data-locale={TRUSTPILOT_LOCALE}
        data-template-id={TRUSTPILOT_TEMPLATE_ID}
        data-businessunit-id={businessUnitId}
        data-style-height={widgetHeight}
        data-style-width="100%"
        data-token={TRUSTPILOT_TOKEN}
      >
        <a href={reviewUrl} target="_blank" rel="noopener noreferrer">
          Trustpilot
        </a>
      </div>
    </div>
  )
}
