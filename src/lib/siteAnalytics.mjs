import { apiUrl } from './api'

const SESSION_KEY = 'ss-visit-session'
const UTM_KEY = 'ss-visit-utm'

/** @returns {string} */
export function getOrCreateVisitSessionId() {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return `anon-${Date.now()}`
  }
}

/** Persist first-touch UTM params for the browser session. */
export function rememberCampaignParams(search) {
  try {
    if (sessionStorage.getItem(UTM_KEY)) return
    const params = new URLSearchParams(search || '')
    const payload = {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
    }
    if (payload.utmSource || payload.utmMedium || payload.utmCampaign) {
      sessionStorage.setItem(UTM_KEY, JSON.stringify(payload))
    }
  } catch {
    /* private mode */
  }
}

function readCampaignParams() {
  try {
    const raw = sessionStorage.getItem(UTM_KEY)
    if (!raw) return { utmSource: '', utmMedium: '', utmCampaign: '' }
    const parsed = JSON.parse(raw)
    return {
      utmSource: typeof parsed.utmSource === 'string' ? parsed.utmSource : '',
      utmMedium: typeof parsed.utmMedium === 'string' ? parsed.utmMedium : '',
      utmCampaign: typeof parsed.utmCampaign === 'string' ? parsed.utmCampaign : '',
    }
  } catch {
    return { utmSource: '', utmMedium: '', utmCampaign: '' }
  }
}

/** Fire-and-forget page view for admin analytics (public site only). */
export function trackPublicPageView(pathname, search = '') {
  if (!pathname || pathname.startsWith('/admin')) return
  rememberCampaignParams(search)
  const { utmSource, utmMedium, utmCampaign } = readCampaignParams()

  const body = JSON.stringify({
    sessionId: getOrCreateVisitSessionId(),
    path: pathname,
    utmSource,
    utmMedium,
    utmCampaign,
    referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
  })

  const url = apiUrl('/api/analytics/page-view')

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => {
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      }
    } catch {
      /* ignore */
    }
  })
}
